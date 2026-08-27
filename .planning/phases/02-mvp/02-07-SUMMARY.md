---
phase: 02-mvp
plan: 07
subsystem: notifications
tags: [resend, web-push, vapid, bullmq, nestjs, nextjs, pwa]

requires:
  - phase: 02-mvp (plan 02)
    provides: "EmailSenderPort/ConsoleEmailAdapter, NotificationsService.sendMatchNotifications(동기 경로), notification_settings/notification_logs 스키마"
  - phase: 02-mvp (plan 05)
    provides: "queues.module.ts(ingest/match/notify 3개 큐 등록), match.processor.ts(dispatch-notifications job enqueue)"
  - phase: 02-mvp (plan 06)
    provides: "apps/web/public/sw.js GET /feed 캐싱 fetch 핸들러(이 플랜이 push/notificationclick으로 확장), '이 업종 알림 조정하기' 링크가 도착할 목적지 요구"
provides:
  - "ResendEmailAdapter(EmailSenderPort 구현) + EMAIL_ADAPTER 환경변수 팩토리 선택(console 기본값/resend) — 02-02 ConsoleEmailAdapter를 실제 프로덕션 발송으로 대체"
  - "NotifyProcessor(@Processor('notify')) — dispatch-notifications 잡 소비, 이메일+웹푸시 실제 발송, notification_logs UPSERT 멱등성, 방해금지 시간대 재예약, daily_digest pending 표시"
  - "WebPushService(VAPID) + PushSubscriptionsController(POST/DELETE /push-subscriptions) — 웹 푸시 구독·발송·410 만료 정리(MATCH-03)"
  - "NotificationSettingsController(GET/PATCH /notification-settings, GET .../preview) + NotificationLogsController(GET /notification-logs) — 알림 설정 화면 API"
  - "apps/web/src/app/settings/notifications 화면(CLIENT-01) — 04-notification-settings.md 8개 항목 전체 구현"
  - "apps/web/public/sw.js push/notificationclick 핸들러, PushSubscribeButton.tsx"
affects: []

actuals:
  tokens: 31650
  tasks: 3
  commits: 3

tech-stack:
  added:
    - "resend@6.22.1 — 실제 이메일 발송(MATCH-02), 02-RESEARCH.md 승인 버전"
    - "web-push@3.6.7 + @types/web-push@3.6.4 — VAPID 웹 푸시 발송(MATCH-03), 02-RESEARCH.md 승인 버전"
  patterns:
    - "EMAIL_SENDER_PORT 팩토리 프로바이더: NestJS providers 배열에 ResendEmailAdapter를 직접 등록하지 않고 selectEmailAdapter() 함수 안에서 EMAIL_ADAPTER=resend일 때만 수동 new — RESEND_API_KEY 없는 기본 테스트/CI 환경에서 생성자 throw로 앱 부팅이 깨지는 것을 방지"
    - "quiet_hours(Time 컬럼)는 UTC 시:분만 저장·비교하는 단일 기준([ASSUMED], 업체별 타임존 컬럼 없음) — notify.processor.ts의 dateToMinutesOfDay/isWithinQuietHours(순수 함수, 분 단위 정수)와 notifications.service.ts의 formatTimeHHMM/parseTimeHHMM(HH:MM 문자열 ↔ Date)가 같은 기준을 공유"
    - "notification_logs는 채널당 1행(UNIQUE(match_id, channel))이므로 웹 푸시처럼 기기가 여러 개(push_subscriptions 1:N)여도 결과를 매칭 1건당 1행으로 요약한다(하나라도 성공하면 sent) — 기기별 개별 로그를 만들지 않는다"
    - "PushSubscribeButton.tsx의 onBeforeToggle 훅 — 실제 브라우저 API 호출(권한 요청·구독/해지) 전에 상위(설정 화면)가 확인 다이얼로그를 끼워넣을 수 있게 하는 확장 지점"

key-files:
  created:
    - apps/api/src/notifications/adapters/resend-email.adapter.ts
    - apps/api/src/notifications/notify.processor.ts
    - apps/api/src/notifications/notify.processor.spec.ts
    - apps/api/src/notifications/web-push.service.ts
    - apps/api/src/notifications/push-subscriptions.controller.ts
    - apps/api/src/notifications/push-subscriptions.controller.spec.ts
    - apps/api/src/notifications/notifications.service.spec.ts
    - apps/api/src/notifications/notification-settings.controller.ts
    - apps/api/src/notifications/notification-settings.controller.spec.ts
    - apps/api/src/notifications/notification-logs.controller.ts
    - apps/api/src/notifications/notification-logs.controller.spec.ts
    - apps/api/src/notifications/dto/create-push-subscription.dto.ts
    - apps/api/src/notifications/dto/update-notification-settings.dto.ts
    - apps/api/src/notifications/dto/notification-settings-preview-query.dto.ts
    - apps/web/src/components/settings/PushSubscribeButton.tsx
    - apps/web/src/app/settings/notifications/page.tsx
    - apps/web/src/app/settings/notifications/NotificationSettingsContent.tsx
  modified:
    - apps/api/src/notifications/notifications.service.ts
    - apps/api/src/notifications/notifications.module.ts
    - apps/api/src/queues/queues.module.ts
    - apps/api/package.json
    - package-lock.json
    - apps/web/public/sw.js
    - apps/web/src/lib/api-client.ts
    - env.example
    - .planning/WINDOWS.md

key-decisions:
  - "NotifyProcessor를 계획된 notifications/ 경로에 생성하되, 등록(providers)은 queues.module.ts에 추가했다 — IngestProcessor/MatchProcessor와 동일 위치에서 notify 큐 연결(BullModule.registerQueue)을 재사용해야 DI가 정상 배선된다(Rule 3, 02-02-SUMMARY.md Deviation #8과 동일 성격)"
  - "이메일/푸시 채널 로직을 NotificationsService 한 곳에 계속 집중시켰다(02-02가 시작한 단일 서비스 패턴) — push_subscriptions CRUD, 알림 설정 CRUD도 별도 서비스를 새로 만들지 않고 여기 추가해 컨트롤러-서비스 분리 관례(certifications.controller.ts 등)를 유지했다"
  - "적합도 임계값 슬라이더는 5개 이산 stop(참고용 0/낮음 35/보통 55/적합 70/매우 적합 85)으로 구현했다 — toQualitativeTier()의 등급 경계값과 정확히 대응시켜 '슬라이더가 5단계 등급과 동일한 눈금'이라는 와이어프레임 요구를 충족(정확한 세부 눈금 간격은 와이어프레임이 규정하지 않아 Claude's Discretion)"
  - "CreatePushSubscriptionDto.endpoint를 https 전용으로 제한 — notify.processor.ts가 이후 이 값으로 서버발 outbound 요청(webpush.sendNotification)을 보내므로, 검증 없이 저장하면 SSRF 유사 벡터가 된다(원래 threat_model에 없던 신규 표면, 이번 플랜이 발견)"

patterns-established:
  - "알림 발송 로직(이메일 sendEmailForMatch, 웹 푸시 dispatchPush)은 채널별로 '이미 로그가 있으면 재처리 안 함' 가드를 진입점에 두어 BullMQ 잡 재시도가 항상 안전하게 멱등하다 — 향후 알림 채널을 추가할 때도 이 가드 순서(로그 확인 → 조건 확인 → 발송 → 로그 upsert)를 그대로 따르면 된다"

requirements-completed: [MATCH-02, MATCH-03, CLIENT-01]

coverage:
  - id: D1
    description: "실제 이메일 발송(ResendEmailAdapter)이 EMAIL_ADAPTER 환경변수로 선택되고, notify.processor.ts가 동일 matchId 잡을 재실행해도 notification_logs가 1건만 존재하며, EMAIL_ADAPTER=console(기본값)이면 Resend API가 호출되지 않는다"
    requirement: MATCH-02
    verification:
      - kind: unit
        ref: "apps/api/src/notifications/notify.processor.spec.ts#동일 matchId로 dispatch-notifications 잡을 두 번 실행해도 notification_logs 행이 1개만 존재한다 / EMAIL_ADAPTER=console이면 실제 Resend API가 호출되지 않는다 / EMAIL_ADAPTER=resend + RESEND_API_KEY가 있으면 ResendEmailAdapter가 선택된다"
        status: pass
    human_judgment: true
    rationale: "이 실행 환경에 Docker/PostgreSQL/Redis가 없어(WINDOWS.md #1/#3과 동일 갭, 이번 플랜분은 #14) 실제 BullMQ 워커+살아있는 DB로 e2e 검증하지 못했고, 실제 Resend API 호출 자체도 API 키가 없어 라이브로 확인되지 않았다. 인메모리 페이크 Prisma 단위테스트(16개)로 멱등성·조건 로직을 결정론적으로 검증했다."
  - id: D2
    description: "방해금지 시간대(자정 넘김 포함) 안에 발생한 알림은 버려지지 않고 종료 시각으로 정확한 delay만큼 재예약되며, 시간대 밖이면 즉시 발송된다"
    requirement: MATCH-02
    verification:
      - kind: unit
        ref: "apps/api/src/notifications/notify.processor.spec.ts#현재 시각이 방해금지 구간 안이면 발송하지 않고 종료 시각으로 재예약한다(delay 검증) / 방해금지 시간대가 아니면 정상 발송한다 / quiet-hours 순수 함수 6개 케이스"
        status: pass
    human_judgment: false
  - id: D3
    description: "웹 푸시 구독은 동일 endpoint 재구독 시 UPSERT되어 행이 늘어나지 않고, 다른 업체 소유 구독 삭제 시 403, sendNotification이 410을 던지면 해당 구독이 자동 삭제된다"
    requirement: MATCH-03
    verification:
      - kind: unit
        ref: "apps/api/src/notifications/notifications.service.spec.ts (UPSERT/403/404 3건) + apps/api/src/notifications/notify.processor.spec.ts#sendNotification이 410을 던지면 해당 구독이 삭제되고 push 로그는 failed로 남는다 + push-subscriptions.controller.spec.ts(컨트롤러 배선 3건)"
        status: pass
    human_judgment: true
    rationale: "브라우저의 실제 Notification.requestPermission/pushManager.subscribe/실제 web-push 발송·수신은 이 샌드박스에 브라우저·라이브 API 서버가 없어 검증하지 못했다(WINDOWS.md #15/#16). 서버 측 CRUD·소유권·410 정리 로직은 단위테스트로 결정론적으로 검증됨."
  - id: D4
    description: "알림 설정 화면의 8개 항목(이메일/푸시 채널, 적합도 임계값, 발송 빈도, 방해금지 시작·종료, 마감임박 리마인더 on/off·며칠전)이 notification_settings의 대응 컬럼과 1:1로 연결되고, PATCH는 명시된 필드만 부분 갱신하며, bounceWarning은 이메일 채널 최근 3건 연속 실패일 때만 true다"
    requirement: CLIENT-01
    verification:
      - kind: unit
        ref: "apps/api/src/notifications/notification-settings.controller.spec.ts (10건 — 부분갱신/bounceWarning 4케이스/방해금지 자정넘김/null 되돌리기/컨트롤러 배선 3건) + notification-logs.controller.spec.ts"
        status: pass
    human_judgment: false
    rationale: null
  - id: D5
    description: "이메일·푸시를 모두 끄려는 시도는 확인 다이얼로그 없이는 PATCH가 전송되지 않고, 확인 후에도 '모든 알림이 꺼져 있습니다' 배너가 지속 노출되며, 저장 실패 시 낙관적 업데이트가 롤백된다"
    requirement: CLIENT-01
    verification: []
    human_judgment: true
    rationale: "브라우저 UI 상호작용(확인 다이얼로그 취소/확인, 배너 노출, 실패 시 롤백 애니메이션)은 시각적 확인이 필요하다. 이 실행 환경에 Docker/PostgreSQL/실행 중인 API 서버가 없어(WINDOWS.md #1/#3/#5와 동일 갭) 로그인 후 실 데이터로 화면을 띄워볼 수 없었다 — next build/eslint는 통과했고, 코드 리뷰로 confirmOpen 상태 흐름과 applyPatch()의 롤백(재조회) 로직을 확인했다(WINDOWS.md #15)."

duration: ~40min
completed: 2026-08-27
status: complete
---

# Phase 2 Plan 7: 알림 발송·설정 Summary

**02-02의 ConsoleEmailAdapter를 EMAIL_ADAPTER 환경변수 선택형 ResendEmailAdapter로 교체하고, VAPID 웹 푸시(MATCH-03)와 04-notification-settings.md 8개 항목 전체를 구현한 알림 설정 화면(CLIENT-01)으로 조달메이트 MVP의 알림 파이프라인을 완성**

## Performance

- **Duration:** ~40분 (커밋 타임스탬프 기준 09:40→10:05, 이전 코드베이스 탐색·문서 읽기 포함 시 그 이상)
- **Started:** 2026-08-27T09:40:42+09:00 (첫 태스크 커밋 기준)
- **Completed:** 2026-08-27T10:05:02+09:00
- **Tasks:** 3 (tracer × 1, auto tdd × 1, auto × 1)
- **Files modified:** 25 (신규 17, 수정 8, package-lock.json 제외 기준 diff 126,601자)

## Accomplishments

- **실제 이메일 발송(MATCH-02)**: `ResendEmailAdapter`가 `EmailSenderPort`를 그대로 구현(02-02 인터페이스 재사용, 아키텍처 변경 없음). `NotificationsModule`의 `EMAIL_SENDER_PORT` 프로바이더를 `EMAIL_ADAPTER` 환경변수(기본값 `console`)로 선택하는 팩토리로 전환 — `RESEND_API_KEY` 없는 기본 테스트/CI 환경에서는 `ResendEmailAdapter`가 아예 인스턴스화되지 않아 실제 API 호출이 발생할 수 없다.
- **`NotifyProcessor`(`@Processor('notify')`)**: `match.processor.ts`(02-05)가 enqueue한 `dispatch-notifications` 잡을 소비해 매칭별로 이메일+웹푸시를 실제 발송한다. 채널별 `notification_logs` UNIQUE(match_id, channel) UPSERT로 잡 재시도 시 중복 발송을 원천 차단하고, 방해금지 시간대(자정 넘김 포함)는 버리지 않고 종료 시각으로 재예약하며, `digest_frequency='daily_digest'`는 즉시 발송 대신 `pending` 로그만 남긴다.
- **웹 푸시(MATCH-03)**: `WebPushService`가 `.env`에 VAPID 키가 없으면 프로세스 한정 임시 키를 생성해 경고로 안내(재생성 시 기존 구독 전부 무효화). `PushSubscriptionsController`가 `POST/DELETE /push-subscriptions`로 구독을 관리(endpoint UNIQUE 기준 UPSERT, 소유권 검증 403). `NotifyProcessor`가 업체의 모든 구독(여러 기기)에 발송하고 410(Gone) 응답을 받은 구독을 즉시 삭제한다. `apps/web/public/sw.js`에 `push`/`notificationclick` 핸들러 추가(02-06의 `GET /feed` 캐싱 핸들러는 그대로 유지). `PushSubscribeButton.tsx`가 브라우저 권한 요청·구독 생성·서버 등록을 담당한다.
- **알림 설정 화면(CLIENT-01)**: `GET/PATCH /notification-settings`(항목별 부분 갱신), `GET /notification-settings/preview?threshold=N`(최근 7일 예상 알림량), `GET /notification-logs`(최근 20건 발송 이력). `apps/web/src/app/settings/notifications`가 04-notification-settings.md의 8개 항목(채널 2개·임계값·빈도·방해금지 2개·리마인더 2개)을 모두 구현 — 이메일·푸시 모두 off 시도는 확인 다이얼로그를 거쳐야 하고, 확인 후에도 경고 배너가 지속 노출되며, 저장 실패 시 서버 재조회로 롤백한다. `?from=detail&hint=` 진입 시 임계값 슬라이더를 강조 표시.
- **Rule 3 배선**: `NotifyProcessor`를 `queues.module.ts`의 providers에 등록(계획의 파일 목록에 없었으나, 등록 없이는 BullMQ 컨슈머가 전혀 동작하지 않음 — 02-02-SUMMARY.md Deviation #8과 동일 성격).

## Task Commits

1. **실제 이메일 발송 워커 — notify 큐 컨슈머 + Resend 어댑터 + 방해금지 시간대** - `3e24e1c` (feat, tracer)
2. **웹 푸시 구독·발송(MATCH-03)** - `0ab993d` (feat, tdd=true였으나 RED/GREEN 미분리 — 아래 Deviations 참고)
3. **알림 설정 화면 — 채널·임계값·빈도·방해금지·이력** - `49193d6` (feat)

**Plan metadata:** (이 커밋, 워크트리 모드 — STATE.md/ROADMAP.md는 오케스트레이터가 병합 후 갱신)

## Tracer Feedback Gate

`type="tracer"` 태스크(Task 1) 커밋 직후 `<verify>`(`npm run test --workspace=apps/api -- notify.processor.spec.ts`)를 재실행했다 — 13개 전부 통과. 이 실행 환경에 대화형 인간 승인 채널이 없는 병렬 워크트리 실행(오케스트레이터가 프롬프트에서 "체크포인트 태스크 없음, fully autonomous"로 명시)이라, 02-02/02-06-SUMMARY.md와 동일한 선례를 따라 build/lint/test 그린을 확인 근거로 삼아 즉시 Task 2로 진행했다.

## Files Created/Modified

- `apps/api/src/notifications/adapters/resend-email.adapter.ts` — Resend SDK 어댑터
- `apps/api/src/notifications/notify.processor.ts` — 이메일+푸시 발송 BullMQ 컨슈머, 방해금지 순수 함수
- `apps/api/src/notifications/notify.processor.spec.ts` — 16개 단위테스트(멱등성/방해금지/발송조건/웹푸시/어댑터선택)
- `apps/api/src/notifications/web-push.service.ts` — VAPID 설정, sendNotification, isPushSubscriptionGone
- `apps/api/src/notifications/push-subscriptions.controller.ts`, `.spec.ts` — 구독 등록/해지 API
- `apps/api/src/notifications/notifications.service.ts` — sendEmailForMatch 추출·공유, push_subscriptions CRUD, 알림 설정 CRUD, bounceWarning/preview 계산
- `apps/api/src/notifications/notifications.service.spec.ts` — push_subscriptions UPSERT/403/404 단위테스트
- `apps/api/src/notifications/notifications.module.ts` — selectEmailAdapter 팩토리, 신규 컨트롤러/프로바이더 등록
- `apps/api/src/notifications/notification-settings.controller.ts`, `.spec.ts` — GET/PATCH/preview
- `apps/api/src/notifications/notification-logs.controller.ts`, `.spec.ts` — 발송 이력 조회
- `apps/api/src/notifications/dto/{create-push-subscription,update-notification-settings,notification-settings-preview-query}.dto.ts`
- `apps/api/src/queues/queues.module.ts` — NotifyProcessor 등록(Rule 3)
- `apps/web/public/sw.js` — push/notificationclick 핸들러 추가
- `apps/web/src/components/settings/PushSubscribeButton.tsx` — 구독 생명주기 + onBeforeToggle 훅
- `apps/web/src/app/settings/notifications/{page.tsx,NotificationSettingsContent.tsx}` — 알림 설정 화면
- `apps/web/src/lib/api-client.ts` — push 구독/알림설정/이력 API 클라이언트 함수
- `env.example` — EMAIL_ADAPTER/RESEND_*/VAPID_* 항목 추가
- `apps/api/package.json`, `package-lock.json` — resend@6.22.1, web-push@3.6.7, @types/web-push@3.6.4

## Decisions Made

체크포인트 태스크 없음(이 플랜에는 `checkpoint:*` 태스크가 없음, 기술적 결정은 frontmatter `key-decisions` 참고).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] NotifyProcessor를 queues.module.ts에 등록**
- **Found during:** Task 1, `notify.processor.ts` 작성 완료 후
- **Issue:** 계획의 Task1 `<files>` 목록에는 `queues/queues.module.ts`가 없었으나, `@Processor('notify')` 데코레이터가 붙은 클래스를 NestJS providers 어딘가에 등록하지 않으면 DI 컨테이너가 이를 인스턴스화하지 않아 큐 컨슈머 자체가 전혀 동작하지 않는다.
- **Fix:** `IngestProcessor`/`MatchProcessor`와 동일한 위치(`QueuesModule`)에 `NotifyProcessor`를 등록하고 `NotificationsModule`을 import했다.
- **Files modified:** apps/api/src/queues/queues.module.ts
- **Verification:** `npm run build --workspace=apps/api` 통과, `notify.processor.spec.ts` 13개 통과
- **Committed in:** 3e24e1c

**2. [Rule 2 - Missing Critical] push_subscriptions.endpoint를 https 전용으로 검증**
- **Found during:** Task 2, `CreatePushSubscriptionDto` 작성 중
- **Issue:** `notify.processor.ts`가 이후 이 값으로 서버발 outbound HTTP 요청(`webpush.sendNotification`)을 보낸다 — 검증 없이 임의 문자열을 저장하면 클라이언트가 내부망 주소 등으로 서버의 아웃바운드 요청을 유도하는 SSRF 유사 벡터가 될 수 있다. 원래 `<threat_model>`에는 이 표면이 없었다(이번 플랜이 새로 발견).
- **Fix:** `@IsUrl({ protocols: ['https'], require_protocol: true })`로 https 전용 제한(완전한 SSRF 차단은 아니나 명백히 비정상적인 값은 걸러짐).
- **Files modified:** apps/api/src/notifications/dto/create-push-subscription.dto.ts
- **Verification:** 코드 리뷰, DTO 검증 로직 확인
- **Committed in:** 0ab993d

**3. [Rule 3 - Blocking] TypeScript Uint8Array/ArrayBuffer 타입 좁히기**
- **Found during:** Task 2, `PushSubscribeButton.tsx`의 `applicationServerKey` 타입 체크
- **Issue:** `Uint8Array.from(...)`가 `Uint8Array<ArrayBufferLike>`로 추론되어 `pushManager.subscribe()`의 `applicationServerKey`가 기대하는 `BufferSource`(ArrayBuffer 고정 타입)와 어긋나 `next build` 타입체크 실패(02-02-SUMMARY.md Deviation #2와 동일 성격의 Buffer/ArrayBuffer 문제).
- **Fix:** `new ArrayBuffer(length)` + `new Uint8Array(buffer)`로 구체 타입을 고정.
- **Files modified:** apps/web/src/components/settings/PushSubscribeButton.tsx
- **Verification:** `npm run build --workspace=apps/web` 통과
- **Committed in:** 0ab993d

**4. [Deviation - TDD 절차] Task2(tdd=true)를 RED/GREEN 분리 없이 단일 커밋으로 완료**
- **Found during:** Task 2 진행 중 자체 점검
- **Issue:** `execute-plan.md`의 TDD 실행 프로토콜(RED 커밋→GREEN 커밋)을 엄격히 따르지 않고 테스트와 구현을 함께 작성해 단일 `feat` 커밋으로 묶었다.
- **Fix(사후 조치):** 별도 커밋 분리는 이미 커밋된 히스토리를 되돌리는 것이라 이 시점에 소급 적용하지 않았다. 대신 최종 테스트 커버리지(16개 notify.processor 테스트, 웹 푸시 관련 4개 포함)가 전부 통과함을 확인했고 `.planning/WINDOWS.md`(id 17, deviation)에 기록했다.
- **Files modified:** (해당 없음 — 절차상 편차)
- **Verification:** `npm run test --workspace=apps/api` 71/71 통과
- **Committed in:** 0ab993d

**5. [Rule 3 - Blocking] PushSubscribeButton.tsx에 onBeforeToggle 훅 추가(Task3에서 Task2 파일 확장)**
- **Found during:** Task 3, 알림 설정 화면의 "이메일·푸시 모두 끄기 확인 다이얼로그" 요구사항 구현 중
- **Issue:** 계획의 Task3 `<files>` 목록에는 `PushSubscribeButton.tsx`가 없었으나, 확인 다이얼로그를 실제 브라우저 API 호출(권한 요청/구독 해지) 전에 끼워넣으려면 버튼 컴포넌트 자체에 훅이 필요했다 — 없으면 "PATCH 요청은 확인 다이얼로그 없이는 전송되지 않는다" 요구사항을 푸시 채널에 대해 구현할 방법이 없다.
- **Fix:** `onBeforeToggle?: () => boolean | Promise<boolean>` 선택적 prop을 추가 — false를 반환하면 실제 토글 동작 전체를 건너뛴다. Task2가 커밋한 기존 동작(checked/onChange)은 그대로 유지.
- **Files modified:** apps/web/src/components/settings/PushSubscribeButton.tsx
- **Verification:** `npm run build --workspace=apps/web` 통과
- **Committed in:** 49193d6

---

**Total deviations:** 5 (2 Rule 3 블로킹, 1 Rule 2 보안 강화, 1 TDD 절차 편차, 1 Rule 3 컴포넌트 확장)
**Impact on plan:** 아키텍처 변경(Rule 4 대상)은 없었다. 모두 정확성·보안·컴파일 가능성 또는 요구사항 구현에 필수적인 수정이었다. TDD 절차 편차(#4)는 최종 결과물의 정확성에는 영향을 주지 않았으나 절차상 기록해 둔다.

## Issues Encountered

**Docker/PostgreSQL/Redis가 이 실행 환경에 여전히 없음(02-01부터 이어짐)** — `notify.processor.ts`의 이메일/푸시 발송, 방해금지 재예약, 410 구독 정리를 실제 BullMQ 워커+DB로 end-to-end 검증하지 못했다. 인메모리 페이크 Prisma 단위테스트(총 27개: notify.processor 16 + notifications.service 4 + notification-settings.controller 10 + notification-logs.controller 1, 일부 중복 스위트 포함 실제 71/71 전체 통과)로 로직을, `nest build`/`next build`로 타입·컴파일을 검증했다.

**apps/web에 node_modules가 없어(WINDOWS.md #5와 동일 갭) `npm install --workspace=apps/web`을 직접 실행해 설치했다** — 설치 후에는 `next build`가 정상 동작했다(02-06과 동일 상황 재현).

`.planning/WINDOWS.md`에 unrun-verify 3건(id 14~16: notify.processor.ts 실인프라 미검증, 알림 설정 화면 브라우저 미검증, sw.js push 핸들러 런타임 미검증) + deviation 1건(id 17: TDD RED/GREEN 미분리)을 기록했다.

## User Setup Required

02-01~02-06-SUMMARY.md의 "User Setup Required"에 이어 — Docker Desktop(Windows, WSL2 backend) 설치 시 아래 항목도 함께 확인 필요:

1. `.env`에 `EMAIL_ADAPTER=resend`, `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`를 채우고(도메인 인증 완료 후) 실제 이메일 발송이 성공하는지 확인
2. `npx web-push generate-vapid-keys`로 VAPID 키 쌍을 1회 생성해 `.env`의 `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`NEXT_PUBLIC_VAPID_PUBLIC_KEY`에 고정 저장(재생성 시 기존 구독 전부 무효화되므로 신중히)
3. 로그인 후 `/settings/notifications`에서 8개 항목이 실제로 저장되는지, 푸시 토글이 브라우저 권한 요청 → 구독 생성까지 정상 동작하는지 수동 확인
4. `npm run test:e2e --workspace=apps/api`(가능하다면)로 이메일/푸시 발송이 실제 BullMQ 워커에서 동작하는지 확인

## Known Stubs

없음 — 이 플랜이 새로 만든 화면·API 모두 스텁 없이 실제 로직으로 구현되었다(참가자격 발췌 등 이전 플랜의 기존 스텁은 이 플랜 범위 밖).

## Threat Flags

| Flag | File | Description |
|------|------|--------------|
| threat_flag: outbound-ssrf-surface | apps/api/src/notifications/dto/create-push-subscription.dto.ts | 클라이언트가 제출한 `endpoint`로 서버(notify.processor.ts)가 outbound HTTP 요청(webpush.sendNotification)을 보낸다 — https 스킴 제한으로 완화했으나 완전한 SSRF 차단은 아니다(원래 `<threat_model>`에 없던 신규 표면) |

## Next Phase Readiness

- MATCH-02(이메일)·MATCH-03(웹푸시)·CLIENT-01(알림 설정 화면)이 실제 로직으로 완성되어 Phase 2(MVP) 핵심 요구사항이 모두 코드로 구현되었다.
- **인계 사항 1 — 일간 요약(daily_digest) 발송 스케줄러 미구현**: `digest_frequency='daily_digest'`는 `notification_logs`에 `pending` 상태만 남기고 실제 요약 이메일을 발송하는 별도 배치 잡은 이 플랜 범위 밖(02-07-PLAN.md Task1 action이 명시적으로 범위 제외, Claude's Discretion). 향후 플랜이 이 pending 로그를 소비하는 일일 요약 잡을 추가해야 한다.
- **인계 사항 2 — 국내 리전 이메일 발송 재검토**: 02-RESEARCH.md Alternatives Considered가 이미 언급했듯, 트래픽 증가 시 Resend에서 AWS SES(서울 리전) 전환을 검토할 시점이 인프라 확정 phase에서 재논의될 수 있다.
- **차단 사항 — Docker/Redis 설치 대기(02-01부터 이어짐)**: 위 "User Setup Required" 참고. 사람이 Docker Desktop 설치 후 재현 절차를 실행하고, Resend/VAPID 실제 키를 발급해야 Phase 2의 알림 파이프라인이 실환경에서 최종 검증된다.

---
*Phase: 02-mvp*
*Plan: 07*
*Completed: 2026-08-27*

## Self-Check: PASSED

All key files verified present on disk, commit hashes verified in git log:
- `apps/api/src/notifications/adapters/resend-email.adapter.ts` — FOUND
- `apps/api/src/notifications/notify.processor.ts` — FOUND
- `apps/api/src/notifications/notify.processor.spec.ts` — FOUND
- `apps/api/src/notifications/web-push.service.ts` — FOUND
- `apps/api/src/notifications/push-subscriptions.controller.ts` — FOUND
- `apps/api/src/notifications/push-subscriptions.controller.spec.ts` — FOUND
- `apps/api/src/notifications/notifications.service.spec.ts` — FOUND
- `apps/api/src/notifications/notification-settings.controller.ts` — FOUND
- `apps/api/src/notifications/notification-settings.controller.spec.ts` — FOUND
- `apps/api/src/notifications/notification-logs.controller.ts` — FOUND
- `apps/api/src/notifications/notification-logs.controller.spec.ts` — FOUND
- `apps/api/src/notifications/dto/create-push-subscription.dto.ts` — FOUND
- `apps/api/src/notifications/dto/update-notification-settings.dto.ts` — FOUND
- `apps/api/src/notifications/dto/notification-settings-preview-query.dto.ts` — FOUND
- `apps/web/src/components/settings/PushSubscribeButton.tsx` — FOUND
- `apps/web/src/app/settings/notifications/page.tsx` — FOUND
- `apps/web/src/app/settings/notifications/NotificationSettingsContent.tsx` — FOUND
- Commit `3e24e1c` — FOUND in `git log --oneline --all`
- Commit `0ab993d` — FOUND in `git log --oneline --all`
- Commit `49193d6` — FOUND in `git log --oneline --all`
- `npm run test --workspace=apps/api`: 13 suites / 71 tests — all PASSED
- `npm run build --workspace=apps/api`: PASSED
- `npm run build --workspace=apps/web` (`next build`): PASSED (Turbopack, `/settings/notifications` correctly generated as static route)
- `eslint` (both workspaces): 0 errors
