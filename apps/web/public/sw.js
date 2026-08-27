// 조달메이트 서비스 워커 — 02-01 스캐폴딩 + 02-06 GET /feed 오프라인 캐싱.
//
// - 02-06: GET /feed 요청에 네트워크 우선 + 실패 시 캐시 폴백 전략을 적용한다
//   (02-feed.md §엣지 케이스 "네트워크 오류·오프라인").
// - 02-07이 push 이벤트 핸들러(웹 푸시 수신, MATCH-03)를 추가할 예정이다.
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
 * GET /feed 네트워크 우선 + 캐시 폴백. apps/web/src/lib/api-client.ts#getFeed()가 이 SW를
 * 거친 응답을 받으므로, 캐시에서 서빙할 때는 `x-jodalmate-cache: hit` 헤더를 추가해
 * 프론트가 "오프라인 상태 — 마지막 업데이트 기준" 배지를 표시할 수 있게 한다
 * (apps/web/src/app/feed/FeedContent.tsx의 isFromCache 판단 기준).
 */
async function handleFeedRequest(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(FEED_CACHE_NAME);
      // 쿼리스트링(필터·정렬)별로 별도 캐시 엔트리를 둔다 — request 자체를 키로 쓴다.
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (networkError) {
    const cache = await caches.open(FEED_CACHE_NAME);
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
