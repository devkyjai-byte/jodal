// 조달메이트 서비스 워커 — 02-01 스캐폴딩 단계.
//
// 이 파일은 최소 설치(install) 이벤트만 처리하는 빈 서비스워커다.
// - 02-06이 fetch 캐싱 핸들러(오프라인 지원)를 추가한다.
// - 02-07이 push 이벤트 핸들러(웹 푸시 수신, MATCH-03)를 추가한다.
//
// self.skipWaiting()으로 새 버전이 등록되는 즉시 활성화되게 한다 — 이 단계에서는
// 캐싱 전략이 없으므로 이전 버전과 충돌할 캐시 자원이 없다.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
