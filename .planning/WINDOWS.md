---
schema_version: 1
open_count: 5
waived_count: 0
fixed_count: 0
total_count: 5
last_updated: 2026-08-26T13:47:01.133Z
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
  }
]
````
