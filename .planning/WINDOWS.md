---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 0
total_count: 3
last_updated: 2026-08-26T06:08:36.408Z
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
  }
]
````
