---
schema_version: 1
open_count: 13
waived_count: 0
fixed_count: 0
total_count: 13
last_updated: 2026-08-27T00:20:13.015Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 02 | unrun-verify | apps/api/test/schema.e2e-spec.ts |  | Docker/PostgreSQL unavailable in this sandboxed execution environment (no docker, no WSL, no local psql) — migrate deploy, db:seed, and schema.e2e-spec.ts could not be run against a live database. Code verified up to the DB-connection boundary (ECONNREFUSED, not a code error). | open |  | 2026-08-26T05:39:43.961Z |  |
| 2 | 02 | deviation | env.example |  | Plan specified .env.example but this execution environment's permission policy denies Write/Bash access to any .env* path regardless of content (placeholder-only). Created env.example (no leading dot) instead; documented in file header. cp env.example .env for local use. | open |  | 2026-08-26T05:39:50.455Z |  |
| 3 | 02 | unrun-verify | apps/api/test/tracer.e2e-spec.ts |  | Docker/PostgreSQL unavailable in this sandboxed execution environment (same gap as WINDOWS.md #1) - AuthService.signup/MatchingService.scoreAndUpsert/NotificationsService.sendMatchNotifications could not be exercised end-to-end against a live DB. Verified up to the DB-connection boundary: npm run build clean, eslint clean, live NestJS boot resolves full DI graph (AuthModule/CompaniesModule/MatchingModule/NotificationsModule), JwtAuthGuard correctly returns 401 without touching the DB, and prisma validate / offline migrate diff pass. The signup/classification-code/matching/notification-log assertions themselves fail with ECONNREFUSED, not a logic error. | open |  | 2026-08-26T06:08:36.408Z |  |
| 4 | 02 | unrun-verify | apps/api/test/classification-codes.e2e-spec.ts |  | Docker/PostgreSQL and .env unavailable in this sandboxed worktree (same gap as WINDOWS.md #1/#3) - classification-codes/companies-me e2e assertions (GET/POST/DELETE classification-codes ownership check, PATCH+GET /companies/me) could not be exercised against a live DB. Verified up to the DB-connection boundary: npm run build (tsc) clean, eslint clean for apps/api/src/companies/**. Failures are 'DATABASE_URL 환경변수가 설정되지 않았습니다', not a logic error. | open |  | 2026-08-26T13:46:51.596Z |  |
| 5 | 02 | unrun-verify | apps/web/src/app/onboarding/page.tsx |  | next build (Turbopack) fails in this worktree with 'Symlink [project]/node_modules is invalid, it points out of the filesystem root' - the worktree has no local node_modules (only the main repo checkout does), and Turbopack refuses to resolve node_modules via a symlink/junction pointing outside the detected workspace root. Verified instead via npx tsc --noEmit (clean) and eslint (clean) for all apps/web/src files touched by this plan (onboarding page + ClassificationStep/RegionStep/PerformanceCertStep/NotificationInitialStep + feed placeholder + api-client.ts). Manual 5-step browser walkthrough (plan <verification> item 3) not performed for the same reason - no working dev/build server in this sandbox. | open |  | 2026-08-26T13:47:01.133Z |  |
| 6 | 02 | unrun-verify | apps/web/src/app/login/page.tsx |  | Docker/PostgreSQL unavailable (same gap as WINDOWS.md #1/#3) - could not verify POST /auth/login end-to-end in a browser (login -> JWT stored -> /feed redirect) or the new companies_contact_email_key UNIQUE migration against a live DB. Verified up to the boundary: unit tests (auth.controller.spec.ts, mocked PrismaService) pass, npm run build/lint clean for both workspaces, dev server renders /login and /signup with expected form fields (fetch check), offline prisma migrate diff matches the manually-written migration SQL exactly. | open |  | 2026-08-26T13:47:59.059Z |  |
| 7 | 02 | unrun-verify | apps/api/src/auth/verification/nts-verification.adapter.ts |  | 국세청 사업자등록정보 진위확인 API의 정확한 엔드포인트/파라미터/응답 스키마가 미확정(02-RESEARCH.md Open Question 2, NTS_API_KEY도 미발급). 어댑터는 RESEARCH.md 코드 예시 패턴을 그대로 구현했으나 실제 API 호출로 검증되지 않았다. 활용신청 승인 후 실제 서비스키로 재검증 필요 - 비차단 설계(실패해도 가입에 영향 없음)이므로 배포 전 필수는 아니지만 진위확인 기능 자체는 동작하지 않을 수 있다. | open |  | 2026-08-26T13:48:09.131Z |  |
| 8 | 02 | unrun-verify | apps/api/tests/fixtures/announcements.bulk.sample.json |  | EXPLAIN ANALYZE on classification_code LIKE '43%' against idx_bid_announcements_classification_code_pattern could not be run - no Postgres in this sandbox (same gap as WINDOWS.md #1/#3). 200-record bulk fixture loaded via prisma upsert hit PrismaClientKnownRequestError ECONNREFUSED before ANALYZE/EXPLAIN could execute. Verified up to the DB-connection boundary: build clean, lint clean, unit tests for scoreAndUpsertForAnnouncements pass. Full verbatim error recorded in 02-05-SUMMARY.md. | open |  | 2026-08-26T13:49:09.571Z |  |
| 9 | 02 | unrun-verify | apps/web/src/app/announcements/[id]/DetailContent.tsx |  | 03-detail.md 4개 엣지케이스(마감됨/개정배너/파싱실패강조/취소삭제)와 above-the-fold 원문 링크 배치를 실제 브라우저에서 시각 검증하지 못함 — 이 실행 환경에 Docker/PostgreSQL/Redis/Meilisearch가 없어(WINDOWS.md #1/#3/#4/#8과 동일 갭) 로그인 후 실제 데이터로 상세 화면을 렌더링할 수 없었다. next build는 성공(타입/컴파일 검증 완료), 로직은 announcements.controller.spec.ts 단위테스트로 검증. | open |  | 2026-08-27T00:19:38.732Z |  |
| 10 | 02 | stub | apps/web/src/app/announcements/[id]/DetailContent.tsx |  | 참가자격 원문 발췌 영역(03-detail.md 레이아웃4)이 항상 정보없음만 표시한다 - bid_announcements 스키마에 참가자격 텍스트 컬럼이 없어 파싱표시할 데이터 자체가 없다. 신규 컬럼 추가는 스키마 변경(Rule4 영역)이라 이번 플랜 범위 밖. | open |  | 2026-08-27T00:19:53.106Z |  |
| 11 | 02 | deviation | apps/api/src/matching/matching.service.ts |  | companies.region_codes(전체 시도명, 예: 서울특별시)와 bid_announcements.region_codes(숫자코드, 예: 11)가 서로 다른 값 형식을 쓴다는 사실을 02-06에서 발견했다 - 02-04/02-01/02-05 소관이라 이번 플랜에서 고치지 않고 deferred-items.md에 기록했다. G2B 실연동 전 반드시 매핑 테이블이 필요하다. | open |  | 2026-08-27T00:19:59.299Z |  |
| 12 | 02 | unrun-verify | apps/api/src/announcements/announcements.service.ts |  | buildSourceUrl()의 나라장터 원문 딥링크 URL 포맷([ASSUMED] g2b.go.kr:8101/ep/invitation/publish/bidInfoDtl.do?bidno&bidseq)이 공식 문서로 검증되지 않았다 - g2b-announcement-source.adapter.ts의 API 필드명 미확정 상태(02-RESEARCH.md Open Question 2)와 동일한 성격의 갭. 활용신청 승인 후 실제 링크로 재검증 필요. | open |  | 2026-08-27T00:20:05.169Z |  |
| 13 | 02 | unrun-verify | apps/web/public/sw.js |  | GET /feed 오프라인 캐시 폴백(네트워크 우선 + 캐시 폴백, x-jodalmate-cache 헤더)을 실제 서비스워커 런타임에서 검증하지 못했다 - 이 실행 환경에 브라우저/DB가 없어 로그인 후 실제 피드 요청을 발생시켜 오프라인 시나리오를 재현할 수 없었다. 코드는 Cache Storage API 표준 패턴을 그대로 구현했으나 런타임 검증은 남아있다. | open |  | 2026-08-27T00:20:13.015Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "apps/api/test/schema.e2e-spec.ts",
    "line": null,
    "description": "Docker/PostgreSQL unavailable in this sandboxed execution environment (no docker, no WSL, no local psql) — migrate deploy, db:seed, and schema.e2e-spec.ts could not be run against a live database. Code verified up to the DB-connection boundary (ECONNREFUSED, not a code error).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T05:39:43.961Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "02",
    "file": "env.example",
    "line": null,
    "description": "Plan specified .env.example but this execution environment's permission policy denies Write/Bash access to any .env* path regardless of content (placeholder-only). Created env.example (no leading dot) instead; documented in file header. cp env.example .env for local use.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T05:39:50.455Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "apps/api/test/tracer.e2e-spec.ts",
    "line": null,
    "description": "Docker/PostgreSQL unavailable in this sandboxed execution environment (same gap as WINDOWS.md #1) - AuthService.signup/MatchingService.scoreAndUpsert/NotificationsService.sendMatchNotifications could not be exercised end-to-end against a live DB. Verified up to the DB-connection boundary: npm run build clean, eslint clean, live NestJS boot resolves full DI graph (AuthModule/CompaniesModule/MatchingModule/NotificationsModule), JwtAuthGuard correctly returns 401 without touching the DB, and prisma validate / offline migrate diff pass. The signup/classification-code/matching/notification-log assertions themselves fail with ECONNREFUSED, not a logic error.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T06:08:36.408Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "apps/api/test/classification-codes.e2e-spec.ts",
    "line": null,
    "description": "Docker/PostgreSQL and .env unavailable in this sandboxed worktree (same gap as WINDOWS.md #1/#3) - classification-codes/companies-me e2e assertions (GET/POST/DELETE classification-codes ownership check, PATCH+GET /companies/me) could not be exercised against a live DB. Verified up to the DB-connection boundary: npm run build (tsc) clean, eslint clean for apps/api/src/companies/**. Failures are 'DATABASE_URL 환경변수가 설정되지 않았습니다', not a logic error.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T13:46:51.596Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "apps/web/src/app/onboarding/page.tsx",
    "line": null,
    "description": "next build (Turbopack) fails in this worktree with 'Symlink [project]/node_modules is invalid, it points out of the filesystem root' - the worktree has no local node_modules (only the main repo checkout does), and Turbopack refuses to resolve node_modules via a symlink/junction pointing outside the detected workspace root. Verified instead via npx tsc --noEmit (clean) and eslint (clean) for all apps/web/src files touched by this plan (onboarding page + ClassificationStep/RegionStep/PerformanceCertStep/NotificationInitialStep + feed placeholder + api-client.ts). Manual 5-step browser walkthrough (plan <verification> item 3) not performed for the same reason - no working dev/build server in this sandbox.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T13:47:01.133Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "apps/web/src/app/login/page.tsx",
    "line": null,
    "description": "Docker/PostgreSQL unavailable (same gap as WINDOWS.md #1/#3) - could not verify POST /auth/login end-to-end in a browser (login -> JWT stored -> /feed redirect) or the new companies_contact_email_key UNIQUE migration against a live DB. Verified up to the boundary: unit tests (auth.controller.spec.ts, mocked PrismaService) pass, npm run build/lint clean for both workspaces, dev server renders /login and /signup with expected form fields (fetch check), offline prisma migrate diff matches the manually-written migration SQL exactly.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T13:47:59.059Z",
    "resolved_at": null
  },
  {
    "id": 7,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "apps/api/src/auth/verification/nts-verification.adapter.ts",
    "line": null,
    "description": "국세청 사업자등록정보 진위확인 API의 정확한 엔드포인트/파라미터/응답 스키마가 미확정(02-RESEARCH.md Open Question 2, NTS_API_KEY도 미발급). 어댑터는 RESEARCH.md 코드 예시 패턴을 그대로 구현했으나 실제 API 호출로 검증되지 않았다. 활용신청 승인 후 실제 서비스키로 재검증 필요 - 비차단 설계(실패해도 가입에 영향 없음)이므로 배포 전 필수는 아니지만 진위확인 기능 자체는 동작하지 않을 수 있다.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T13:48:09.131Z",
    "resolved_at": null
  },
  {
    "id": 8,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "apps/api/tests/fixtures/announcements.bulk.sample.json",
    "line": null,
    "description": "EXPLAIN ANALYZE on classification_code LIKE '43%' against idx_bid_announcements_classification_code_pattern could not be run - no Postgres in this sandbox (same gap as WINDOWS.md #1/#3). 200-record bulk fixture loaded via prisma upsert hit PrismaClientKnownRequestError ECONNREFUSED before ANALYZE/EXPLAIN could execute. Verified up to the DB-connection boundary: build clean, lint clean, unit tests for scoreAndUpsertForAnnouncements pass. Full verbatim error recorded in 02-05-SUMMARY.md.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T13:49:09.571Z",
    "resolved_at": null
  },
  {
    "id": 9,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "apps/web/src/app/announcements/[id]/DetailContent.tsx",
    "line": null,
    "description": "03-detail.md 4개 엣지케이스(마감됨/개정배너/파싱실패강조/취소삭제)와 above-the-fold 원문 링크 배치를 실제 브라우저에서 시각 검증하지 못함 — 이 실행 환경에 Docker/PostgreSQL/Redis/Meilisearch가 없어(WINDOWS.md #1/#3/#4/#8과 동일 갭) 로그인 후 실제 데이터로 상세 화면을 렌더링할 수 없었다. next build는 성공(타입/컴파일 검증 완료), 로직은 announcements.controller.spec.ts 단위테스트로 검증.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-27T00:19:38.732Z",
    "resolved_at": null
  },
  {
    "id": 10,
    "kind": "stub",
    "phase": "02",
    "file": "apps/web/src/app/announcements/[id]/DetailContent.tsx",
    "line": null,
    "description": "참가자격 원문 발췌 영역(03-detail.md 레이아웃4)이 항상 정보없음만 표시한다 - bid_announcements 스키마에 참가자격 텍스트 컬럼이 없어 파싱표시할 데이터 자체가 없다. 신규 컬럼 추가는 스키마 변경(Rule4 영역)이라 이번 플랜 범위 밖.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-27T00:19:53.106Z",
    "resolved_at": null
  },
  {
    "id": 11,
    "kind": "deviation",
    "phase": "02",
    "file": "apps/api/src/matching/matching.service.ts",
    "line": null,
    "description": "companies.region_codes(전체 시도명, 예: 서울특별시)와 bid_announcements.region_codes(숫자코드, 예: 11)가 서로 다른 값 형식을 쓴다는 사실을 02-06에서 발견했다 - 02-04/02-01/02-05 소관이라 이번 플랜에서 고치지 않고 deferred-items.md에 기록했다. G2B 실연동 전 반드시 매핑 테이블이 필요하다.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-27T00:19:59.299Z",
    "resolved_at": null
  },
  {
    "id": 12,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "apps/api/src/announcements/announcements.service.ts",
    "line": null,
    "description": "buildSourceUrl()의 나라장터 원문 딥링크 URL 포맷([ASSUMED] g2b.go.kr:8101/ep/invitation/publish/bidInfoDtl.do?bidno&bidseq)이 공식 문서로 검증되지 않았다 - g2b-announcement-source.adapter.ts의 API 필드명 미확정 상태(02-RESEARCH.md Open Question 2)와 동일한 성격의 갭. 활용신청 승인 후 실제 링크로 재검증 필요.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-27T00:20:05.169Z",
    "resolved_at": null
  },
  {
    "id": 13,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "apps/web/public/sw.js",
    "line": null,
    "description": "GET /feed 오프라인 캐시 폴백(네트워크 우선 + 캐시 폴백, x-jodalmate-cache 헤더)을 실제 서비스워커 런타임에서 검증하지 못했다 - 이 실행 환경에 브라우저/DB가 없어 로그인 후 실제 피드 요청을 발생시켜 오프라인 시나리오를 재현할 수 없었다. 코드는 Cache Storage API 표준 패턴을 그대로 구현했으나 런타임 검증은 남아있다.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-27T00:20:13.015Z",
    "resolved_at": null
  }
]
````
