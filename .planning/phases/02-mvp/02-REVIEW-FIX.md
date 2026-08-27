---
phase: 02-mvp
fixed_at: 2026-08-27T13:42:00Z
review_path: .planning/phases/02-mvp/02-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-08-27T13:42:00Z
**Source review:** .planning/phases/02-mvp/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (fix_scope=critical_warning — 1 critical + 6 warnings; IN-01/IN-02 excluded)
- Fixed: 7
- Skipped: 0

**Verification environment:** All fixes were applied and verified inside an isolated git
worktree (`.claude/worktrees/rf-02-2359-1787805058`, on temp branch `gsd-reviewfix/02-2359`,
branched from `master`). `npm run --workspace=apps/api build` and
`npm run test --workspace=apps/api` (75/75 tests, 13/13 suites) were run inside that worktree
after every change and once more after the final fix. The worktree's `node_modules` resolved
via Node's normal upward directory walk to the main repo's `node_modules` (worktree lives under
`.claude/worktrees/` inside the repo tree), so results are reproducible from the main checkout —
no separate dependency install was needed. The worktree branch was fast-forwarded into `master`
cleanly (no divergence) and removed after all commits landed; the main checkout at
`C:/web/claude-code -test/조달청` now contains all 7 fix commits directly on `master`.

## Fixed Issues

### CR-01: Region code format mismatch breaks region-based match scoring for the default (fixture) data source

**Files modified:** `apps/api/tests/fixtures/announcements.sample.json`,
`apps/api/tests/fixtures/announcements.bulk.sample.json`,
`apps/api/tests/fixtures/announcements.revision.sample.json`,
`apps/api/src/matching/matching.service.spec.ts`, `.planning/phases/02-mvp/deferred-items.md`
**Commit:** `62a88c4`
**Applied fix:** Normalized all three fixture JSON files' `regionCodes` from two-digit numeric
administrative codes (`"11"`, `"26"`, `"41"`, `"48"`) to the full Korean province names already
used by `RegionStep.tsx` and documented as the canonical contract in `SearchQueryDto`
(`"서울특별시"`, `"부산광역시"`, `"경기도"`, `"경상남도"`) — 235 region-code values normalized
across the three files via a scripted JSON transform (verified valid JSON post-transform). Also
corrected a stale inline comment in `announcements.sample.json` that referenced the old numeric
code. Added a new `scoreMatch — 지역 매칭 가점(+25)` describe block (4 cases) to
`matching.service.spec.ts` that directly exercises the exported `scoreMatch` function and asserts
the +25 regional bonus is applied when representations match, stays unapplied when they don't
(including the exact original bug shape: full-name vs numeric-code mismatch), and that the
전국(empty regionCodes) partial +15 bonus still works — this is the regression coverage the prior
`tracer.e2e-spec.ts`'s `score > 0` assertion was missing. Updated `deferred-items.md` item 1 to
mark it fixed, describe the fix, and flag the remaining follow-up (`G2BAnnouncementSourceAdapter`
still hardcodes `regionCodes: []` and must emit the same full-name representation once real G2B
region parsing is implemented).

### WR-01: No `ParseUUIDPipe`/validation on `:id` route params — malformed IDs surface as raw 500s instead of 404

**Files modified:** `apps/api/src/companies/classification-codes.controller.ts`,
`apps/api/src/companies/performances.controller.ts`,
`apps/api/src/companies/certifications.controller.ts`,
`apps/api/src/notifications/push-subscriptions.controller.ts`,
`apps/api/src/announcements/announcements.controller.ts`
**Commit:** `4729b16`
**Applied fix:** Added `@Param('id', new ParseUUIDPipe())` on every id-scoped `DELETE`/`GET`
route across the five controllers named in the finding. For `announcements.controller.ts`'s
optional `match_id` query param, used `@Query('match_id', new ParseUUIDPipe({ optional: true }))`
(confirmed the installed `@nestjs/common@11.2.3` `ParseUUIDPipe` supports the `optional` option
by inspecting its implementation) so malformed IDs now surface as a clean 400 instead of an
unhandled Prisma `invalid input syntax for type uuid` 500, while `match_id` remains genuinely
optional (untouched when absent).

### WR-02: Access token stored in `localStorage` — no XSS-resistant storage

**Files modified:** `apps/web/src/lib/api-client.ts`
**Commit:** `952c10d`
**Applied fix:** Per the review's own "at minimum" guidance, documented this as a consciously
accepted MVP tradeoff with a new threat-model comment (`T-02-19`, following the codebase's
existing `T-02-xx` threat-annotation convention used throughout `auth.service.ts` and the
controllers) directly above `ACCESS_TOKEN_STORAGE_KEY`, explaining the XSS exposure and listing
the two production-hardening options from the review (httpOnly+SameSite cookie with CSRF
protection, or a strict CSP) as prioritized follow-ups. No behavioral change — this documents
the accepted risk rather than silently leaving it unstated, consistent with the rest of the
codebase's explicit ASVS threat-tracking pattern.

### WR-03: `enableCors()` called with no origin allowlist

**Files modified:** `apps/api/src/main.ts`, `env.example`
**Commit:** `88ed5c3`
**Applied fix:** Replaced the unrestricted `app.enableCors()` with
`app.enableCors({ origin: corsOrigins })`, where `corsOrigins` is parsed from a new `CORS_ORIGIN`
env var (comma-separated, trimmed, empty entries filtered) and falls back to
`['http://localhost:3000']` (the existing dev-server default) when unset. Documented the new
`CORS_ORIGIN` variable in `env.example` with guidance that production deployments must set it
explicitly.

### WR-04: Service worker caches `GET /feed` by URL only, ignoring the Authorization header — cross-account data can leak on shared devices

**Files modified:** `apps/web/public/sw.js`
**Commit:** `d5dd409`
**Applied fix:** Added `getCompanyIdFromRequest()`, which reads the `Authorization: Bearer <jwt>`
header from the intercepted request and decodes (without verifying signature — used only for
cache namespacing, not authorization) the JWT payload's `companyId` field (base64url-decode +
`JSON.parse`, with padding correction), and `feedCacheNameForRequest()`, which derives a
per-company Cache Storage name (`jodalmate-feed-cache-v1-{companyId}`, or `-anon` if no valid
token is present). `handleFeedRequest()` now opens/reads/writes that per-company cache instead of
the single shared `FEED_CACHE_NAME`, so company B logging in after company A on a shared device
can no longer be served company A's cached `/feed` responses — different companies get disjoint
Cache Storage entries. Verified with `node -c` (sw.js uses browser-only globals `self`/`caches`/
`atob` so only a syntax check applies — Tier 2 partial, Tier 1 full re-read confirmed intact).

### WR-05: `digest_frequency = 'daily_digest'` silently results in emails that are never sent

**Files modified:** `apps/web/src/app/settings/notifications/NotificationSettingsContent.tsx`
**Commit:** `a6e81f7`
**Applied fix:** Per the review's second suggested option (ship the sender was out of scope for
a single fix commit — building a digest scheduler is a multi-task feature, not a targeted fix),
added a "준비 중" (coming soon) badge next to the "일간 요약" radio option and a conditional
amber warning banner (shown only when that option is currently selected) explaining the option
does not yet send emails and recommending "즉시" instead, so users are no longer silently opted
into receiving zero notifications without any UI indication.

### WR-06: No global handling for expired/invalid JWT on the frontend

**Files modified:** `apps/web/src/lib/api-client.ts`
**Commit:** `90dbcc3`
**Applied fix:** Added a shared 401 handler inside `handleResponse()`: when a response is
`401` and a stored access token exists (guards against firing on login/signup's own credential-
mismatch 401s, which never held a token), the handler clears the stored token via a new
`clearAccessToken()` export and redirects to `/login` via `window.location.href`, before the
existing `ApiError` is thrown (so any in-flight `.catch()` handlers in individual pages still run,
but the redirect is already underway). Guarded by `typeof window !== 'undefined'` consistent with
the file's existing SSR-safety pattern.

## Skipped Issues

None — all 7 in-scope findings were fixed.

---

_Fixed: 2026-08-27T13:42:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
