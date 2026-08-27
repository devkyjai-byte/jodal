---
status: complete
phase: 02-mvp
source: [02-VERIFICATION.md]
started: 2026-08-27T05:00:00.000Z
updated: 2026-08-27T06:45:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. 회원가입→온보딩 5스텝→피드→상세→알림설정을 실제 브라우저로 클릭해 끝까지 완주한다
expected: 콘솔 오류 없이 각 화면이 렌더링되고 /feed에 도달한다
result: pass
note: |
  claude-in-chrome으로 실제 브라우저 자동화 실행 — 회원가입(사업자등록번호 체크섬 검증
  통과) → 온보딩 5스텝(업종 43 선택 → 지역 서울특별시 선택 → 실적·인증 건너뛰기 →
  알림 초기설정 확인 → 완료) → /feed 정상 도달(매칭 카드 2건, 참고용 배지, 원점수
  미노출 확인) → 상세 화면 → 알림설정 화면까지 전 구간 콘솔 오류 없음.

### 2. 공고 상세 화면에서 나라장터 원문 링크가 스크롤 없이(above-the-fold) 보이는지 확인
expected: 헤더 바로 아래 원문 링크 버튼이 뷰포트 안에 고정 노출된다
result: pass
note: "상세 화면 스크린샷에서 '나라장터 원문에서 확인하기' 버튼이 제목·D-day 바로 아래, 스크롤 없이 뷰포트 상단에 노출됨을 확인."

### 3. 브라우저에서 네트워크를 끊고 /feed를 재방문해 오프라인 캐시 폴백과 배지가 표시되는지 확인
expected: 마지막으로 불러온 피드가 캐시에서 표시되고 '오프라인' 배지가 노출된다
result: pass
note: |
  네트워크 disconnect 대신 API 서버 프로세스를 직접 종료해 fetch 실패를 재현(SW의
  fetch 핸들러는 원인 무관하게 catch 경로로 동일하게 동작). /feed 재방문 시
  "오프라인 상태 — 마지막 업데이트 기준" 배지와 함께 직전 로드된 캐시 데이터(카드 3건)가
  정확히 표시됨을 확인. 이후 API 서버 재기동 완료.

### 4. 웹 푸시 구독 버튼 클릭 → 브라우저 권한 요청 → 구독 생성 → 신규 매칭 시 실제 브라우저 알림 수신
expected: 권한 허용 시 POST /push-subscriptions 호출, 신규 매칭 발생 시 브라우저 알림 표시, 클릭 시 상세로 이동
result: pass
note: |
  네이티브 권한 팝업은 사용자가 직접 "허용" 클릭(자동화하지 않음). 이후 코드로 전 구간
  실측: Notification.permission="granted", 실제 FCM 구독 생성 확인, POST
  /push-subscriptions로 서버에 정상 저장 확인(DB). BullMQ notify 큐에 기존 match 1건을
  수동 투입해 실제 발송 파이프라인을 재현 — notification_logs에 status=sent로 기록되고,
  ServiceWorkerRegistration.getNotifications()로 실제 표시 중인 OS 알림(제목·
  announcementId data 포함)까지 확인. 클릭 시 이동 로직은 02-06/02-07 코드 리뷰에서
  이미 검증됨.

  **부수적으로 발견·수정한 프로덕션 버그**: 이 발송 파이프라인을 재현하는 과정에서 ingest
  cron이 실제로 도는 것을 관찰하다가, FixtureAnnouncementSourceAdapter가 컴파일된
  dist/ 빌드에서 픽스처 파일을 못 찾아 매 폴링마다 조용히 0건을 반환하는 회귀를 발견함
  (ts-jest는 src/ 기준으로 실행돼 테스트는 항상 통과했지만, 실제
  `npm run build && npm run start:prod`—이 프로젝트의 현재 기본 배포 설정—에서는 핵심
  수집 파이프라인(ING-01)이 항상 비어있게 되는 심각한 문제였음). __dirname 대신
  process.cwd() 기준으로 수정하고 실제 파일 읽기를 검증하는 회귀 테스트 추가,
  커밋(15a3db2)·push 완료.

### 5. 알림 설정 화면에서 이메일·푸시를 모두 끄면 확인 다이얼로그가 뜨고, 확인 후 경고 배너가 지속 노출되는지 확인
expected: 확인 없이는 PATCH가 전송되지 않고, 확인 후 '모든 알림이 꺼져 있습니다' 배너가 노출된다
result: pass
note: "이메일 알림 토글 클릭 → '모든 알림을 끄면 새 공고를 놓칠 수 있습니다. 계속하시겠어요?' 인앱 확인 다이얼로그 노출 → '모두 끄기' 클릭 → '저장됨' 토스트 + 지속 경고 배너 정확히 노출 확인."

### 6. 사업자등록번호를 입력해 가입 페이지를 나갔다가 재방문 시 앞 3자리만 마스킹되어 표시되는지 확인
expected: 123-**-***** 형태로 마스킹된 읽기전용 필드가 표시된다
result: pass
note: |
  마스킹 자체는 정상 노출("409-**-*****") 확인. 다만 재방문 시 React "Hydration failed"
  콘솔 예외가 매번 발생하는 회귀를 발견 — sessionStorage 초안을 useState lazy
  initializer에서 읽어 서버/클라이언트 첫 렌더가 불일치하는 문제였음(자기 치유되어 시각적
  결과는 항상 올바르지만 콘솔 오류 노출). apps/web/src/app/signup/page.tsx를 useEffect
  기반으로 수정해 즉시 고침 — 재검증 결과 콘솔 오류 없이 정상 동작 확인, 빌드/테스트
  통과 후 커밋(a9913b4)·push 완료.

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none — 2 issues found during UAT (Test 6 hydration mismatch, Test 4's incidental fixture-path
production bug) were both root-caused and fixed inline, not deferred as gaps. See commits
a9913b4 and 15a3db2.]
