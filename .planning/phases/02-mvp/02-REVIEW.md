---
phase: 02-mvp
reviewed: 2026-08-27T00:00:00Z
depth: standard
files_reviewed: 88
files_reviewed_list:
  - .gitignore
  - apps/api/package.json
  - apps/api/prisma.config.ts
  - apps/api/prisma/migrations/20260826000001_init/migration.sql
  - apps/api/prisma/migrations/20260826000002_add_check_constraints/migration.sql
  - apps/api/prisma/migrations/20260826000003_fix_region_codes_not_null_default/migration.sql
  - apps/api/prisma/migrations/20260826000004_add_companies_contact_email_unique/migration.sql
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/seed.ts
  - apps/api/src/announcements/adapters/fixture-announcement-source.adapter.ts
  - apps/api/src/announcements/adapters/g2b-announcement-source.adapter.ts
  - apps/api/src/announcements/announcements.controller.spec.ts
  - apps/api/src/announcements/announcements.controller.ts
  - apps/api/src/announcements/announcements.module.ts
  - apps/api/src/announcements/announcements.service.spec.ts
  - apps/api/src/announcements/announcements.service.ts
  - apps/api/src/announcements/dto/search-query.dto.ts
  - apps/api/src/announcements/ports/announcement-source.port.ts
  - apps/api/src/app.module.ts
  - apps/api/src/auth/auth.controller.spec.ts
  - apps/api/src/auth/auth.controller.ts
  - apps/api/src/auth/auth.module.ts
  - apps/api/src/auth/auth.service.spec.ts
  - apps/api/src/auth/auth.service.ts
  - apps/api/src/auth/crypto/business-reg-no.crypto.ts
  - apps/api/src/auth/crypto/password.crypto.ts
  - apps/api/src/auth/dto/login.dto.ts
  - apps/api/src/auth/dto/signup.dto.ts
  - apps/api/src/auth/jwt.strategy.ts
  - apps/api/src/auth/jwt-auth.guard.ts
  - apps/api/src/auth/verification/nts-verification.adapter.ts
  - apps/api/src/auth/verification/nts-verification.port.ts
  - apps/api/src/companies/certifications.controller.spec.ts
  - apps/api/src/companies/certifications.controller.ts
  - apps/api/src/companies/classification-codes.controller.ts
  - apps/api/src/companies/companies.controller.ts
  - apps/api/src/companies/companies.module.ts
  - apps/api/src/companies/companies.service.ts
  - apps/api/src/companies/dto/add-certification.dto.ts
  - apps/api/src/companies/dto/add-classification-code.dto.ts
  - apps/api/src/companies/dto/add-performance.dto.ts
  - apps/api/src/companies/dto/update-region-codes.dto.ts
  - apps/api/src/companies/performances.controller.spec.ts
  - apps/api/src/companies/performances.controller.ts
  - apps/api/src/main.ts
  - apps/api/src/matching/matching.module.ts
  - apps/api/src/matching/matching.service.spec.ts
  - apps/api/src/matching/matching.service.ts
  - apps/api/src/notifications/adapters/console-email.adapter.ts
  - apps/api/src/notifications/adapters/resend-email.adapter.ts
  - apps/api/src/notifications/dto/create-push-subscription.dto.ts
  - apps/api/src/notifications/dto/notification-settings-preview-query.dto.ts
  - apps/api/src/notifications/dto/update-notification-settings.dto.ts
  - apps/api/src/notifications/notification-logs.controller.spec.ts
  - apps/api/src/notifications/notification-logs.controller.ts
  - apps/api/src/notifications/notifications.module.ts
  - apps/api/src/notifications/notifications.service.spec.ts
  - apps/api/src/notifications/notifications.service.ts
  - apps/api/src/notifications/notification-settings.controller.spec.ts
  - apps/api/src/notifications/notification-settings.controller.ts
  - apps/api/src/notifications/notify.processor.spec.ts
  - apps/api/src/notifications/notify.processor.ts
  - apps/api/src/notifications/ports/email-sender.port.ts
  - apps/api/src/notifications/push-subscriptions.controller.spec.ts
  - apps/api/src/notifications/push-subscriptions.controller.ts
  - apps/api/src/notifications/web-push.service.ts
  - apps/api/src/prisma/prisma.module.ts
  - apps/api/src/prisma/prisma.service.ts
  - apps/api/src/queues/ingest.processor.ts
  - apps/api/src/queues/match.processor.ts
  - apps/api/src/queues/queues.module.ts
  - apps/api/src/search/meilisearch.service.ts
  - apps/api/src/search/search.module.ts
  - apps/api/src/test-utils/meilisearch.mock.ts
  - apps/api/test/classification-codes.e2e-spec.ts
  - apps/api/test/schema.e2e-spec.ts
  - apps/api/test/tracer.e2e-spec.ts
  - apps/api/tests/fixtures/announcements.bulk.sample.json
  - apps/api/tests/fixtures/announcements.revision.sample.json
  - apps/api/tests/fixtures/announcements.sample.json
  - apps/web/public/manifest.json
  - apps/web/public/sw.js
  - apps/web/src/app/announcements/[id]/DetailContent.tsx
  - apps/web/src/app/announcements/[id]/page.tsx
  - apps/web/src/app/feed/FeedContent.tsx
  - apps/web/src/app/feed/page.tsx
  - apps/web/src/app/layout.tsx
  - apps/web/src/app/login/page.tsx
  - apps/web/src/app/onboarding/page.tsx
  - apps/web/src/app/service-worker-register.tsx
  - apps/web/src/app/settings/notifications/NotificationSettingsContent.tsx
  - apps/web/src/app/settings/notifications/page.tsx
  - apps/web/src/app/signup/page.tsx
  - apps/web/src/components/feed/AnnouncementCard.tsx
  - apps/web/src/components/feed/FilterBar.tsx
  - apps/web/src/components/onboarding/ClassificationStep.tsx
  - apps/web/src/components/onboarding/NotificationInitialStep.tsx
  - apps/web/src/components/onboarding/PerformanceCertStep.tsx
  - apps/web/src/components/onboarding/RegionStep.tsx
  - apps/web/src/components/settings/PushSubscribeButton.tsx
  - apps/web/src/lib/api-client.ts
  - apps/web/src/lib/classification-tree.data.ts
  - docker-compose.yml
  - env.example
  - package.json
  - package-lock.json
  - scripts/dev.cjs
findings:
  critical: 1
  warning: 6
  info: 2
  total: 9
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-08-27T00:00:00Z
**Depth:** standard
**Files Reviewed:** 88 (full phase scope; some files, e.g. bulk fixture, spot-checked due to size)
**Status:** issues_found

## Summary

Reviewed the full Phase 02 MVP slice: auth (signup/login, AES-256-GCM + HMAC business-reg-no
handling, scrypt password hashing), company profile CRUD, matching/scoring, the
ingest → match → notify BullMQ pipeline, Meilisearch-backed feed search, web push, and the
Next.js frontend (onboarding, feed, detail, notification settings, service worker).

Overall the implementation is careful and threat-model-aware (timing-safe login, ownership
checks on every mutate/delete endpoint, no plaintext business-reg-no storage, score never
leaked to the client, idempotent notification dispatch). However, one concrete correctness
defect undermines a core scoring signal for the shipped default configuration, and several
robustness/security hardening gaps were found that are not covered by existing tests.

## Critical Issues

### CR-01: Region code format mismatch breaks region-based match scoring for the default (fixture) data source

**File:** `apps/api/tests/fixtures/announcements.sample.json:8,24,40,56,72` (also
`announcements.bulk.sample.json`, `announcements.revision.sample.json`), compared against
`apps/web/src/components/onboarding/RegionStep.tsx:7-25` and
`apps/api/src/matching/matching.service.ts:52-59`

**Issue:** `companies.region_codes` is populated from the onboarding UI using full Korean
province names (`RegionStep.tsx` REGIONS array: `'서울특별시'`, `'경기도'`, `'부산광역시'`, …),
and `apps/api/src/announcements/dto/search-query.dto.ts:30` and the controller spec fixtures
(`announcements.controller.spec.ts`) confirm this is the intended representation for
`bid_announcements.region_codes` too ("companies.region_codes와 동일한 표기(예:
"서울특별시")를 그대로 쓴다"). But the actual JSON fixtures consumed at runtime by
`FixtureAnnouncementSourceAdapter` — which is the **default** `ANNOUNCEMENT_SOURCE` per
`env.example` — use two-digit numeric administrative codes instead (`"11"`, `"26"`, `"41"`,
`"48"`, i.e. 서울/부산/경기/경남 codes).

Because `MatchingService.scoreMatch()` does exact string containment
(`company.regionCodes.some(r => announcement.regionCodes.includes(r))`), a company that
registers "서울특별시" as its activity region will **never** match an announcement whose
`regionCodes` contains `"11"` — the 25-point regional match bonus is silently never awarded,
and `AnnouncementsService.getFeed()`'s `query.region` filter (same string-equality logic)
will exclude every fixture announcement that has a non-empty `regionCodes` array. This is not
caught by `test/tracer.e2e-spec.ts` because that test only asserts `score > 0`, which is
already satisfied by the classification-code match (60 pts) alone — insufficient test
coverage masked the defect.

In production with `ANNOUNCEMENT_SOURCE=g2b`, `G2BAnnouncementSourceAdapter.parseItem()`
hardcodes `regionCodes: []` (not yet implemented), so this specific defect doesn't manifest
there yet — but it will resurface the moment real region-code parsing is added unless the
representation is unified first.

**Fix:** Pick one canonical representation for `region_codes` across both tables (either
full province names everywhere, or numeric admin codes everywhere) and add a mapping/utility
if the ingest source and the profile UI must use different externally-sourced formats. As an
immediate fix, normalize the fixture JSON files to use the same full-name strings the
onboarding UI and `SearchQueryDto` already use, e.g.:
```json
"regionCodes": ["서울특별시"]
```
and add an assertion in `tracer.e2e-spec.ts` (or a new `matching.service.spec.ts` case) that
specifically verifies the +25 regional bonus is applied when `company.regionCodes` overlaps
`announcement.regionCodes`.

## Warnings

### WR-01: No `ParseUUIDPipe`/validation on `:id` route params — malformed IDs surface as raw 500s instead of 404

**File:** `apps/api/src/companies/classification-codes.controller.ts:77-87`,
`apps/api/src/companies/performances.controller.ts:74-81`,
`apps/api/src/companies/certifications.controller.ts:73-80`,
`apps/api/src/notifications/push-subscriptions.controller.ts:45-55`,
`apps/api/src/announcements/announcements.controller.ts:38-45`

**Issue:** Every `DELETE /:id` (and `GET /announcements/:id`, and the `match_id` query param
in `getDetail`) reads the id straight from `@Param('id') id: string` / `@Query('match_id')`
with no `ParseUUIDPipe` or format validation, then passes it directly into
`prisma.<model>.findUnique({ where: { id } })`. Since the underlying Postgres columns are
`UUID`, an arbitrary non-UUID string (e.g. `DELETE /companies/me/performances/not-a-uuid`)
causes Postgres to reject the parameter with `invalid input syntax for type uuid`, which
bubbles up as an unhandled Prisma error rather than the intended 404/403. There is no global
exception filter in `main.ts` to normalize this into a clean 4xx, so callers get a bare 500
for what should be a routine "not found" case.

**Fix:** Add `@Param('id', new ParseUUIDPipe()) id: string` (NestJS built-in pipe) on every
id-scoped route, or validate with a small custom pipe/regex before hitting Prisma.

### WR-02: Access token stored in `localStorage` — no XSS-resistant storage

**File:** `apps/web/src/lib/api-client.ts:110-120`

**Issue:** `storeAccessToken`/`getAccessToken` persist the JWT in `window.localStorage`
under `jodalmate_access_token`, and every authenticated request reads it back and sends it
as a Bearer token. Any XSS on the site (stored or reflected) can exfiltrate this token
directly via `localStorage.getItem(...)`, since it is script-readable. Given the rest of the
codebase is explicitly ASVS-driven (T-02-xx threat entries throughout `auth.service.ts` and
elsewhere), this is a notable gap: there is no httpOnly-cookie-based alternative or any CSP
documented to mitigate it.

**Fix:** At minimum, document/accept this as a conscious MVP tradeoff; for production
hardening, prefer an httpOnly, SameSite cookie set by the API (with CSRF protection) over
`localStorage`, or add a strict CSP to reduce XSS surface if `localStorage` is kept.

### WR-03: `enableCors()` called with no origin allowlist

**File:** `apps/api/src/main.ts:8`

**Issue:** `app.enableCors()` is invoked with no options, which reflects the requesting
`Origin` header and allows any origin to call the API (the comment says this is "개발 중"
convenience for the Next.js dev server on a different port, but there is no env-based branch
that tightens this for production). Combined with WR-02 (bearer token in `localStorage`,
readable but not automatically attached to cross-origin requests by the browser), the direct
risk is limited today, but this is still a permissive default that should not ship unchanged
to production.

**Fix:** Gate CORS origin by `NODE_ENV`/`CORS_ORIGIN` env var, e.g.
`app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:3000' })`.

### WR-04: Service worker caches `GET /feed` by URL only, ignoring the Authorization header — cross-account data can leak on shared devices

**File:** `apps/web/public/sw.js:26-53`

**Issue:** `handleFeedRequest()` caches the network response for `GET /feed?...` keyed purely
by `request` (i.e. URL + method), via the Cache Storage API. The `Authorization: Bearer <jwt>`
header sent by `apps/web/src/lib/api-client.ts#getFeed()` is not part of the cache key. If two
different companies use the same browser profile on the same device (log out of company A,
log in as company B — there is no logout flow that clears this cache either), company B can
be served company A's cached, company-scoped match data (`x-jodalmate-cache: hit`) for any
`/feed?...` query string company A previously triggered, until the network round-trip
succeeds and overwrites that cache entry.

**Fix:** Include a per-company cache namespace (e.g. embed a hash of the JWT's `companyId` in
the cache name, or clear `FEED_CACHE_NAME` on token change/logout), or disable the SW cache
entirely for authenticated endpoints and rely on the "offline: no cache" fallback path only.

### WR-05: `digest_frequency = 'daily_digest'` silently results in emails that are never sent

**File:** `apps/api/src/notifications/notify.processor.ts:123-132`

**Issue:** When a company's `digestFrequency` is `'daily_digest'`, `dispatchEmail()` writes a
`notification_logs` row with `status: 'pending'` and returns — by design, no digest sender
exists yet (explicitly called out as out-of-scope in the surrounding comment). Because
`dispatchEmail()` short-circuits on `hasEmailLog` (any existing log for the `email` channel,
regardless of status) on every subsequent run, these rows stay `'pending'` forever and the
company **never receives an email** for that match through any code path. The settings UI
(`NotificationSettingsContent.tsx`) offers "일간 요약" as a first-class option with no
indication that it is currently a no-op.

**Fix:** Either ship the daily digest sender in this phase, or surface a clear "coming soon"
state in the UI for the daily-digest radio option so users aren't silently opted into
receiving zero notifications.

### WR-06: No global handling for expired/invalid JWT on the frontend

**File:** `apps/web/src/lib/api-client.ts:50-68`

**Issue:** `handleResponse()` throws a generic `ApiError` for any non-2xx response, including
401s caused by an expired JWT (24h fixed expiry, no refresh flow). Individual pages
(`FeedContent.tsx`, `NotificationSettingsContent.tsx`, `DetailContent.tsx`) each render
whatever `err.message` comes back as an inline error, rather than detecting 401 centrally and
redirecting to `/login` (they only check `getAccessToken()` truthiness at mount, not token
validity). A user whose session expires mid-browsing sees an opaque "불러오지 못했습니다"
message instead of being routed back to login.

**Fix:** Add a shared 401 handler in `api-client.ts` (e.g. in `handleResponse`, on
`res.status === 401`, clear the stored token and redirect to `/login`).

## Info

### IN-01: `SignupDto.password` has no `@MaxLength`

**File:** `apps/api/src/auth/dto/signup.dto.ts:26-28`

**Issue:** Every other string field in the onboarding/company DTOs (`companyName`,
`contactEmail`, `certType`, etc.) has an explicit `@MaxLength`; `password` only has
`@MinLength(8)`. Not independently exploitable given Express's default body-size limit, but
inconsistent with the rest of the codebase's DTO conventions.

**Fix:** Add `@MaxLength(128)` (or similar) for consistency.

### IN-02: `AddPerformanceDto.contractAmount` accepts unbounded numeric strings

**File:** `apps/api/src/companies/dto/add-performance.dto.ts:21-23`

**Issue:** `@IsNumberString()` allows arbitrarily large digit strings before they're passed to
`new Prisma.Decimal(...)` in `CompaniesService.addPerformance()`. The DB column is
`Decimal(15, 0)`, so an out-of-range value (e.g. 20 digits) will fail at the Prisma/Postgres
layer with a raw error rather than a clean 400 from validation.

**Fix:** Add a custom validator or regex (`@Matches(/^\d{1,15}$/)`) to reject values that
can't fit the column before they reach Prisma.

---

_Reviewed: 2026-08-27T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
