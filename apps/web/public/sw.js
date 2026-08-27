// 조달메이트 서비스 워커 — 02-01 스캐폴딩 + 02-06 GET /feed 오프라인 캐싱 + 02-07 웹 푸시 수신.
//
// - 02-06: GET /feed 요청에 네트워크 우선 + 실패 시 캐시 폴백 전략을 적용한다
//   (02-feed.md §엣지 케이스 "네트워크 오류·오프라인").
// - 02-07: push 이벤트(웹 푸시 수신, MATCH-03) + notificationclick(공고 상세 이동)을 추가한다
//   (02-RESEARCH.md §Architecture Patterns Pattern 2).
//
// self.skipWaiting()으로 새 버전이 등록되는 즉시 활성화되게 한다.

const FEED_CACHE_NAME = 'jodalmate-feed-cache-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Authorization 헤더의 JWT payload에서 companyId를 꺼낸다 — 서명 검증은 하지 않는다(실제
 * 인증/인가는 항상 서버가 담당하며, 여기서는 오직 Cache Storage 네임스페이스 분리 용도로만
 * 쓴다). 파싱에 실패하면 null을 반환해 "익명" 네임스페이스로 폴백한다.
 */
function getCompanyIdFromRequest(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length);
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const payload = JSON.parse(atob(base64));
    return typeof payload.companyId === 'string' ? payload.companyId : null;
  } catch {
    return null;
  }
}

/**
 * 업체별로 별도 Cache Storage 이름을 써서, 같은 브라우저 프로필을 여러 업체가 공유하는
 * 기기(로그아웃 후 다른 업체로 재로그인)에서 company A의 캐시된 /feed 응답이 company B에게
 * 서빙되지 않게 한다(02-REVIEW.md WR-04).
 */
function feedCacheNameForRequest(request) {
  const companyId = getCompanyIdFromRequest(request);
  return companyId ? `${FEED_CACHE_NAME}-${companyId}` : `${FEED_CACHE_NAME}-anon`;
}

/**
 * GET /feed 네트워크 우선 + 캐시 폴백. apps/web/src/lib/api-client.ts#getFeed()가 이 SW를
 * 거친 응답을 받으므로, 캐시에서 서빙할 때는 `x-jodalmate-cache: hit` 헤더를 추가해
 * 프론트가 "오프라인 상태 — 마지막 업데이트 기준" 배지를 표시할 수 있게 한다
 * (apps/web/src/app/feed/FeedContent.tsx의 isFromCache 판단 기준).
 */
async function handleFeedRequest(request) {
  const cacheName = feedCacheNameForRequest(request);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(cacheName);
      // 쿼리스트링(필터·정렬)별로 별도 캐시 엔트리를 둔다 — request 자체를 키로 쓴다.
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (networkError) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (!cached) {
      // 캐시조차 없으면 원래의 네트워크 실패를 그대로 다시 던진다 — 페이지의 fetch()
      // 호출이 TypeError로 reject되어 "캐시 없음 + 재시도 버튼" 분기를 탈 수 있게 한다
      // (apps/web/src/app/feed/FeedContent.tsx의 offlineNoCache 분기).
      throw networkError;
    }
    const headers = new Headers(cached.headers);
    headers.set('x-jodalmate-cache', 'hit');
    const body = await cached.clone().blob();
    return new Response(body, {
      status: cached.status,
      statusText: cached.statusText,
      headers,
    });
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'GET' && url.pathname === '/feed') {
    event.respondWith(handleFeedRequest(event.request));
  }
});

/**
 * 웹 푸시 수신(MATCH-03) — notify.processor.ts(web-push.service.ts)가 보낸 JSON payload
 * ({ title, announcementId })를 그대로 showNotification()에 반영한다. payload가 없거나
 * JSON 파싱에 실패해도 서비스 워커 자체가 죽지 않도록 안전하게 폴백한다.
 */
self.addEventListener('push', (event) => {
  let payload = { title: '조달메이트에 새 매칭 공고가 있습니다', announcementId: null };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      // JSON이 아니면 원문 텍스트를 제목으로 사용 — 발송측 오류로 알림 자체가 사라지지 않게 함.
      const text = event.data.text();
      if (text) payload.title = text;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: '탭하여 공고 상세를 확인하세요.',
      data: { announcementId: payload.announcementId },
      // manifest.json이 이미 임시 아이콘으로 쓰고 있는 /next.svg를 재사용한다 — 실제 앱
      // 아이콘(PNG 192/512)은 02-01부터 이어지는 기존 갭(WINDOWS.md)이며 이 플랜 범위 밖.
      icon: '/next.svg',
      badge: '/next.svg',
    }),
  );
});

/**
 * 알림 클릭 시 공고 상세로 이동(announcementId가 있을 때만). 이미 열려 있는 탭이 있으면
 * 그 탭을 포커스하고, 없으면 새 탭을 연다.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const announcementId = event.notification.data && event.notification.data.announcementId;
  const targetUrl = announcementId ? `/announcements/${announcementId}` : '/feed';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      }),
  );
});
