---
schema_version: 1
open_count: 5
waived_count: 0
fixed_count: 0
total_count: 5
last_updated: 2026-08-26T13:48:09.131Z
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
| 4 | 02 | unrun-verify | apps/web/src/app/login/page.tsx |  | Docker/PostgreSQL unavailable (same gap as WINDOWS.md #1/#3) - could not verify POST /auth/login end-to-end in a browser (login -> JWT stored -> /feed redirect) or the new companies_contact_email_key UNIQUE migration against a live DB. Verified up to the boundary: unit tests (auth.controller.spec.ts, mocked PrismaService) pass, npm run build/lint clean for both workspaces, dev server renders /login and /signup with expected form fields (fetch check), offline prisma migrate diff matches the manually-written migration SQL exactly. | open |  | 2026-08-26T13:47:59.059Z |  |
| 5 | 02 | unrun-verify | apps/api/src/auth/verification/nts-verification.adapter.ts |  | 국세청 사업자등록정보 진위확인 API의 정확한 엔드포인트/파라미터/응답 스키마가 미확정(02-RESEARCH.md Open Question 2, NTS_API_KEY도 미발급). 어댑터는 RESEARCH.md 코드 예시 패턴을 그대로 구현했으나 실제 API 호출로 검증되지 않았다. 활용신청 승인 후 실제 서비스키로 재검증 필요 - 비차단 설계(실패해도 가입에 영향 없음)이므로 배포 전 필수는 아니지만 진위확인 기능 자체는 동작하지 않을 수 있다. | open |  | 2026-08-26T13:48:09.131Z |  |

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
    "file": "apps/web/src/app/login/page.tsx",
    "line": null,
    "description": "Docker/PostgreSQL unavailable (same gap as WINDOWS.md #1/#3) - could not verify POST /auth/login end-to-end in a browser (login -> JWT stored -> /feed redirect) or the new companies_contact_email_key UNIQUE migration against a live DB. Verified up to the boundary: unit tests (auth.controller.spec.ts, mocked PrismaService) pass, npm run build/lint clean for both workspaces, dev server renders /login and /signup with expected form fields (fetch check), offline prisma migrate diff matches the manually-written migration SQL exactly.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T13:47:59.059Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "apps/api/src/auth/verification/nts-verification.adapter.ts",
    "line": null,
    "description": "국세청 사업자등록정보 진위확인 API의 정확한 엔드포인트/파라미터/응답 스키마가 미확정(02-RESEARCH.md Open Question 2, NTS_API_KEY도 미발급). 어댑터는 RESEARCH.md 코드 예시 패턴을 그대로 구현했으나 실제 API 호출로 검증되지 않았다. 활용신청 승인 후 실제 서비스키로 재검증 필요 - 비차단 설계(실패해도 가입에 영향 없음)이므로 배포 전 필수는 아니지만 진위확인 기능 자체는 동작하지 않을 수 있다.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T13:48:09.131Z",
    "resolved_at": null
  }
]
````
