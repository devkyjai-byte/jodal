---
phase: 02-mvp
verified: 2026-08-27T04:54:46Z
status: passed
score: 16/16 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:

  - test: "회원가입→온보딩 5스텝→피드→상세→알림설정을 실제 브라우저로 클릭해 끝까지 완주한다"
    expected: "콘솔 오류 없이 각 화면이 렌더링되고 /feed에 도달한다"
    why_human: "시각적 레이아웃·클릭 흐름은 코드 검증만으로는 확인 불가. API 계층은 이번 검증에서 실제 Docker(Postgres/Redis/Meilisearch)로 라이브 확인됨."

  - test: "공고 상세 화면에서 나라장터 원문 링크가 스크롤 없이(above-the-fold) 보이는지 확인"
    expected: "헤더 바로 아래 원문 링크 버튼이 뷰포트 안에 고정 노출된다"
    why_human: "레이아웃 배치는 시각적 확인이 필요하다(DetailContent.tsx 코드 리뷰로 구조는 확인됨)"

  - test: "브라우저에서 네트워크를 끊고 /feed를 재방문해 오프라인 캐시 폴백과 배지가 표시되는지 확인"
    expected: "마지막으로 불러온 피드가 캐시에서 표시되고 '오프라인' 배지가 노출된다"
    why_human: "Service Worker Cache Storage 동작은 실제 브라우저 런타임에서만 관찰 가능(WR-04 fix로 companyId 네임스페이스가 적용된 sw.js는 코드 레벨로 확인함)"

  - test: "웹 푸시 구독 버튼 클릭 → 브라우저 권한 요청 → 구독 생성 → 신규 매칭 시 실제 브라우저 알림 수신"
    expected: "권한 허용 시 POST /push-subscriptions 호출, 신규 매칭 발생 시 브라우저 알림 표시, 클릭 시 상세로 이동"
    why_human: "Notification.requestPermission/pushManager.subscribe/실제 push 수신은 브라우저 API로만 검증 가능(서버 측 로직은 notify.processor.spec.ts 16건으로 라이브 이전 단계까지 확인됨)"

  - test: "알림 설정 화면에서 이메일·푸시를 모두 끄면 확인 다이얼로그가 뜨고, 확인 후 경고 배너가 지속 노출되는지 확인"
    expected: "확인 없이는 PATCH가 전송되지 않고, 확인 후 '모든 알림이 꺼져 있습니다' 배너가 노출된다"
    why_human: "다이얼로그·배너의 실제 렌더링은 브라우저 상호작용 확인 필요(confirmOpen 상태 흐름은 코드 리뷰로 확인됨)"

  - test: "사업자등록번호를 입력해 가입 페이지를 나갔다가 재방문 시 앞 3자리만 마스킹되어 표시되는지 확인"
    expected: "123-**-***** 형태로 마스킹된 읽기전용 필드가 표시된다"
    why_human: "sessionStorage 재방문 시나리오는 실제 브라우저 탭 재방문으로만 관찰 가능(maskBusinessRegNo 로직은 코드 리뷰로 확인됨)"
---

# Phase 02: MVP Verification Report

**Phase Goal:** "받고 싶은 조달을 놓치지 않는다"는 핵심 가치를 매칭·알림 기능 하나로 완결시킨다
**Verified:** 2026-08-27T04:54:46Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Verification Methodology (important — read first)

Every prior SUMMARY.md in this phase (02-01 through 02-07) reported that Docker/PostgreSQL/
Redis/Meilisearch were **unavailable** in the executor sandbox, and marked nearly every
DB-dependent truth as `human_judgment: true` / `status: unknown`, relying on unit tests with
fake Prisma plus build/lint as the only evidence.

**In this verification session, Docker Desktop was available and running.** Rather than accept
the SUMMARY narrative at face value, this verification:

1. Started real `postgres:16`, `redis:7`, `getmeili/meilisearch:v1.10` containers via
   `docker compose up -d` (project name `jodalmate`, since the default project name derived
   from the path failed due to the space/Korean characters in `C:/web/claude-code -test/조달청`).

2. Applied all 4 Prisma migrations with `npx prisma migrate deploy` against the real DB —
   **succeeded cleanly, 0 errors.**

3. Ran `npm run db:seed` — **succeeded, 5 fixture announcements loaded.**
4. Ran `apps/api/test/schema.e2e-spec.ts` against the real DB — **3/3 passed** (9-table
   existence, seed count ≥ 5, no plaintext `business_reg_no` column).

5. Ran the full unit suite once (`npm run test --workspace=apps/api`) — **75/75 passed,
   13/13 suites.**

6. Built both workspaces (`npm run build --workspace=apps/api`, `npm run build
   --workspace=apps/web`) — **both passed cleanly**, including Next.js static generation for
   all 8 routes.

7. Built `dist/` and **booted the actual NestJS server** (`node dist/src/main.js`) against the
   live Postgres/Redis/Meilisearch containers, then drove it with real `curl` HTTP requests to
   independently re-verify the core signup→classification→match→notify→search→detail loop
   end-to-end — see Behavioral Spot-Checks below. This is materially stronger evidence than any
   previous SUMMARY had available, since it exercises real Prisma writes, real BullMQ-adjacent
   JWT/DB code paths, and real Meilisearch indexing/search, not mocks.

8. Cleaned up afterward: killed the test server process, ran `docker compose -p jodalmate down`,
   removed the temporary `apps/api/.env` and two scratch test files
   (`tests/fixtures/verify-region-patch.json`, `tests/fixtures/verify-trigger-ingest.ts`) created
   for this verification. `git status` confirms the working tree is clean — no artifacts from
   this verification session were left in the repo.

One methodology note: an early duplicate-signup request returned `500` instead of the expected
`409`, coinciding exactly with the Docker Postgres container silently disappearing mid-session
(`docker ps -a` showed it gone entirely, not just stopped) — this is sandbox/Docker-Desktop
instability, not an application defect. After restarting the container and re-running the same
request cleanly, it correctly returned `409`. This is noted for transparency but not counted as
a finding.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | [Roadmap SC1] 사용자는 업종·지역·실적·인증 정보를 등록해 업체 프로필을 완성할 수 있다 | ✓ VERIFIED | Live: `POST /companies/me/classification-codes` → 201, `PATCH /companies/me {regionCodes}` → 200, `GET /companies/me` reflects both. `performances.controller.spec.ts`/`certifications.controller.spec.ts` (5 tests) pass for the optional-and-skippable performance/cert CRUD. |
| 2 | [Roadmap SC2] 시스템은 나라장터 신규 공고를 배치로 자동 수집해 중복·개정을 병합한 정규화된 형태로 저장한다 | ✓ VERIFIED | Live: invoked `AnnouncementsService.pollAndUpsert()` directly through a Nest application context against the real DB — ingested 5 fixture announcements, normalized fields, indexed into Meilisearch. Revision-merge behavior (`is_latest_revision` flip, no deletion of existing `matches`) is a state-transition truth confirmed via the pre-existing `announcements.service.spec.ts` test (part of the 75/75 passing full-suite run just executed, not re-run in isolation per spot-check constraints). |
| 3 | [Roadmap SC3] 사용자는 자신의 프로필과 적합도 높은 신규 공고를 이메일 또는 푸시 알림으로 받는다 | ✓ VERIFIED | Live: after registering an exact 8-digit classification match with a region match, `matches.score` became `85` and `notification_logs` recorded exactly 2 rows with `channel='email', status='sent'` (one per matched announcement, idempotent — re-triggering matching did not create duplicates). Web push send path (`notify.processor.spec.ts`, 16 tests incl. quiet-hours delay math and 410-expiry cleanup) passing in the full suite; `EMAIL_ADAPTER=console` default confirmed to not call Resend (live log showed no outbound Resend call). |
| 4 | [Roadmap SC4] 사용자는 웹(Next.js PWA)에서 공고를 키워드·업종·지역·마감일로 검색·필터링해 볼 수 있다 | ✓ VERIFIED | Live: `GET /feed?keyword=유지보수` (URL-encoded) returned exactly the 2 announcements whose titles contain that keyword, via real Meilisearch (`/indexes` confirmed 1 populated index, 5 docs). `next build` succeeded generating `/feed`, `/announcements/[id]` (dynamic route). classification/region/deadline filter logic covered by `announcements.controller.spec.ts` (part of the passing suite). |
| 5 | 신규 업체가 사업자등록번호·업체명·이메일·비밀번호로 가입하면 계정이 즉시 생성되고 JWT가 발급된다 (PROF-05) | ✓ VERIFIED | Live: `POST /auth/signup` → `201` with `accessToken` + `company` object; row confirmed created in `companies` table via direct Prisma query. |
| 6 | 이미 등록된 사업자등록번호(다이제스트 기준)로 재가입을 시도하면 409로 거부된다 (PROF-05) | ✓ VERIFIED | Live: retried the same `businessRegNo` cleanly (after the Docker instability noted above was resolved) → `409 {"message":"이미 등록된 사업자등록번호입니다."}`. |
| 7 | JWT 없이 보호된 프로필 엔드포인트를 호출하면 401이 반환된다 | ✓ VERIFIED | Live: `POST /companies/me/classification-codes` without `Authorization` header → `401 {"message":"Unauthorized"}`. |
| 8 | 가입한 업체는 이메일·비밀번호로 로그인해 JWT를 재발급받을 수 있고, 계정 존재 여부가 노출되지 않는다 (PROF-05) | ✓ VERIFIED | Live: `POST /auth/login` with correct credentials → `200` + JWT, used successfully for all subsequent authenticated calls. User-enumeration-resistance (same 401 for missing-email vs wrong-password, timing-safe dummy hash) confirmed via `auth.controller.spec.ts` (3/3 passing in full suite). |
| 9 | 국세청 진위확인 API가 지연·실패해도 가입 응답(201) 자체는 영향받지 않는다 (PROF-05) | ✓ VERIFIED | Live: server log showed `NTS verification failed ... NTS_API_KEY 환경변수가 설정되지 않았습니다` immediately after the signup call, but the signup HTTP response had already returned `201` — confirms fire-and-forget non-blocking design works for real, not just in mocks. |
| 10 | `GET /companies/me`가 regionCodes·classificationCodes·profileComplete를 한 번에 반환한다 | ✓ VERIFIED | Live: response included `regionCodes`, registered `classificationCodes`, `verificationStatus`. |
| 11 | 피드 카드는 적합도를 5단계 정성 등급으로만 표시하고, 원점수·백분율은 어디에도 노출되지 않는다 (Legal 제약, MATCH-01) | ✓ VERIFIED | Live: `GET /feed` response JSON keys are `id, title, agencyName, classificationCode, regionCodes, budgetAmount, bidCloseAt, isExpired, qualitativeTier, matchReason` — no `score` field anywhere. `qualitativeTier` values (`"매우 적합"` for score 85, `"적합"` for score 75) match `toQualitativeTier()`'s documented thresholds exactly. |
| 12 | 다른 업체의 match_id로 상세에 접근하면 403이 반환된다 (CLIENT-01) | ✓ VERIFIED | Live: created a second company, used its JWT to call `GET /announcements/:id?match_id=<company1's match>` → `403 {"message":"본인 업체의 매칭 정보로만 상세를 조회할 수 있습니다."}`. |
| 13 | 적합도 임계값 이상 신규 매칭에 대해 알림 발송 기록이 notification_logs에 sent 상태로 정확히 1건만 남는다 (재시도해도 중복 발송되지 않는다), MATCH-02 | ✓ VERIFIED | Live: deleting and re-registering the same classification code re-ran `scoreAndUpsert` twice for the same two matches; `notification_logs` stayed at exactly 2 rows (one per match, `channel='email'`), not duplicated — UPSERT-on-`(match_id, channel)` confirmed idempotent against a real DB, not just a fake-Prisma unit test. |
| 14 | CR-01 code-review fix (region code format mismatch) actually lands and works | ✓ VERIFIED | Live, direct A/B proof: before the company's `regionCodes` matched the announcement's `regionCodes` (`["서울특별시"]` on both sides, encoding-verified byte-for-byte equal), `matches.score` was `60` (prefix bonus only); after the region values matched, the same match recomputed to `85` (60 + 25 region bonus) — the exact defect CR-01 described, now fixed. Also confirmed via source read: all three fixture JSON files use full province names, `matching.service.spec.ts` has a dedicated `scoreMatch — 지역 매칭 가점(+25)` describe block (4 cases). |
| 15 | 나머지 6개 WR code-review fixes (WR-01 ParseUUIDPipe, WR-02 documented tradeoff, WR-03 CORS allowlist, WR-04 per-company SW cache, WR-05 daily-digest "coming soon" badge, WR-06 shared 401 handler) actually landed in source, not just claimed in 02-REVIEW-FIX.md | ✓ VERIFIED | Source grep confirms all 6: `ParseUUIDPipe` present on 5 controllers' id-scoped routes; `main.ts` uses `CORS_ORIGIN` env-driven `corsOrigins` array instead of bare `enableCors()`; `sw.js` has `getCompanyIdFromRequest()`/`feedCacheNameForRequest()` namespacing the feed cache per company; `NotificationSettingsContent.tsx` renders a "준비 중" badge + warning banner for the daily-digest option; `api-client.ts` has a `clearAccessToken()` + `res.status === 401` redirect-to-login handler and a `T-02-19` threat-annotation comment documenting the `localStorage` JWT tradeoff. |
| 16 | 요구사항 ID 커버리지: PROF-01~05, ING-01~04, MATCH-01~03, CLIENT-01 모두 어떤 플랜이든 소유한다 (orphan 없음) | ✓ VERIFIED | Cross-referenced every plan's frontmatter `requirements:` field against `.planning/REQUIREMENTS.md`. Union = {PROF-01..05, ING-01..04, MATCH-01..03, CLIENT-01} — exactly matches the phase's declared requirement-ID list. No orphans. |

**Score:** 16/16 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/prisma/schema.prisma` | 9-table schema | ✓ VERIFIED | 4 migrations applied cleanly to real Postgres 16 |
| `apps/api/src/auth/auth.service.ts` | signup/login/crypto | ✓ VERIFIED | Live signup/login/409/401 all confirmed |
| `apps/api/src/matching/matching.service.ts` | scoreMatch/scoreAndUpsert(ForAnnouncements) | ✓ VERIFIED | Live scoring confirmed (60→85 region-bonus A/B test) |
| `apps/api/src/notifications/notifications.service.ts` + `notify.processor.ts` | idempotent dispatch | ✓ VERIFIED | Live idempotency confirmed (no dup rows on re-trigger) |
| `apps/api/src/announcements/announcements.service.ts` | pollAndUpsert, normalize, revision-merge | ✓ VERIFIED | Live ingest run confirmed 5 rows + Meilisearch indexing |
| `apps/api/src/search/meilisearch.service.ts` | index/search | ✓ VERIFIED | Live keyword search returned correct subset |
| `apps/api/src/announcements/announcements.controller.ts` | GET /feed, GET /announcements/:id | ✓ VERIFIED | Live: score-free feed response, 403 ownership check |
| `apps/web/src/app/feed`, `.../announcements/[id]`, `.../settings/notifications`, `.../onboarding`, `.../signup`, `.../login` | full UI | ✓ VERIFIED (build) | `next build` succeeded, all 8 routes generated; visual/interaction confirmation is a human item (see below) |
| `apps/api/test/tracer.e2e-spec.ts`, `apps/api/test/classification-codes.e2e-spec.ts` | automated e2e verify commands for 02-02 / 02-04 | ⚠️ BROKEN (see Anti-Patterns) | Cannot even parse under `test/jest-e2e.json` — see WARNING finding below. Underlying behavior independently re-verified live (see truths 5–13 above), so this does not block the phase, but the artifacts' stated automated-verification purpose is currently non-functional. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Migrations apply to real DB | `npx prisma migrate deploy` | 4/4 migrations applied, 0 errors | ✓ PASS |
| Seed loads fixtures | `npm run db:seed` | `bid_announcements` row count: 5 | ✓ PASS |
| Schema e2e (real DB) | `npm run test:e2e -- schema.e2e-spec.ts` | 3/3 passed | ✓ PASS |
| Full unit suite (real, run once) | `npm run test --workspace=apps/api` | 75/75 passed, 13/13 suites | ✓ PASS |
| API build | `npm run build --workspace=apps/api` | clean | ✓ PASS |
| Web build | `npm run build --workspace=apps/web` | clean, 8 routes generated | ✓ PASS |
| Live server boot (real Postgres+Redis+Meilisearch) | `node dist/src/main.js` | "Nest application successfully started" | ✓ PASS |
| `POST /auth/signup` | curl | 201 + JWT, row in DB | ✓ PASS |
| `POST /auth/signup` (duplicate) | curl | 409 (after resolving a transient Docker container drop) | ✓ PASS |
| `POST /companies/me/classification-codes` (no JWT) | curl | 401 | ✓ PASS |
| `POST /auth/login` | curl | 200 + JWT | ✓ PASS |
| `PATCH /companies/me` + `GET /companies/me` | curl | regionCodes round-trips correctly | ✓ PASS |
| Matching score recompute (region bonus) | curl + direct Prisma query | 60 → 85 after region alignment | ✓ PASS |
| Notification idempotency | direct Prisma query after 2x match trigger | 2 `notification_logs` rows, not 4 | ✓ PASS |
| `GET /feed` (score-free response) | curl | no `score` field, `qualitativeTier` present | ✓ PASS |
| `GET /feed?keyword=...` (real Meilisearch) | curl | correct keyword-filtered subset | ✓ PASS |
| `GET /announcements/:id?match_id=<other company's>` | curl (2nd company JWT) | 403 | ✓ PASS |
| Debt-marker scan (`TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER`) | grep across `apps/api/src`, `apps/web/src` | 0 matches | ✓ PASS |
| `apps/api/test/tracer.e2e-spec.ts` under real DB | `npm run test:e2e -- tracer.e2e-spec.ts` | `SyntaxError: Unexpected token 'export'` (meilisearch ESM, unrelated to DB) | ✗ FAIL (see WARNING) |
| `apps/api/test/classification-codes.e2e-spec.ts` under real DB | `npm run test:e2e -- classification-codes.e2e-spec.ts` | same `SyntaxError` | ✗ FAIL (see WARNING) |

### Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
|-------------|-----------------|--------|----------|
| PROF-01 | 02-04 | ✓ SATISFIED | Live classification-code CRUD + ownership 403 pattern |
| PROF-02 | 02-04 | ✓ SATISFIED | Live `PATCH`/`GET /companies/me` region round-trip |
| PROF-03 | 02-04 | ✓ SATISFIED | `performances.controller.spec.ts` (3/3), optional/skippable design |
| PROF-04 | 02-04 | ✓ SATISFIED | `certifications.controller.spec.ts` (2/2) |
| PROF-05 | 02-02, 02-03 | ✓ SATISFIED | Live signup/login/409/NTS-non-blocking all confirmed |
| ING-01 | 02-05 | ✓ SATISFIED | `FixtureAnnouncementSourceAdapter` live-confirmed as default active source; `G2BAnnouncementSourceAdapter` exists, compiles, correctly inactive (accepted gap: unexercised against live 나라장터 API, documented and expected per STATE.md Blockers) |
| ING-02 | 02-05 | ✓ SATISFIED | Live `pollAndUpsert()` normalized 5 fixtures into `bid_announcements` |
| ING-03 | 02-05 | ✓ SATISFIED | Revision-merge unit test passing in full suite (state-transition truth) |
| ING-04 | 02-06 | ✓ SATISFIED | Live keyword search via real Meilisearch |
| MATCH-01 | 02-02, 02-05, 02-06 | ✓ SATISFIED | Live scoring, live region-bonus fix (CR-01), score never leaked to client |
| MATCH-02 | 02-07 | ✓ SATISFIED | Live idempotent `notification_logs` dispatch; `EMAIL_ADAPTER=console` confirmed safe default |
| MATCH-03 | 02-07 | ✓ SATISFIED | `notify.processor.spec.ts`/`push-subscriptions.controller.spec.ts` (server-side fully unit-tested); browser-side subscribe flow is a human item |
| CLIENT-01 | 02-01, 02-02, 02-03, 02-04, 02-06, 02-07 | ✓ SATISFIED | Both workspaces build cleanly, all routes generated, PWA manifest/sw.js present, live API responses confirmed correct shape |

No orphaned requirements found — every ID in `.planning/REQUIREMENTS.md`'s Phase-1(=02-mvp) rows is claimed by exactly one or more plans in this phase's `requirements:` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/api/test/jest-e2e.json` | (whole file) | Missing `moduleNameMapper` for the ESM-only `meilisearch` package (present in the unit-test jest config in `package.json` since 02-06, never backported here) | ⚠️ WARNING | Any e2e spec importing `AppModule` — currently `tracer.e2e-spec.ts` (02-02's own mandated `<verify>` command) and `classification-codes.e2e-spec.ts` (02-04's own mandated `<verify>` command) — fails immediately with `SyntaxError: Unexpected token 'export'` while parsing `meilisearch/dist/index.js`, **regardless of whether a real database is available**. This is a genuine regression introduced by 02-06 (which added a real `import { Meilisearch } from 'meilisearch'` into `AnnouncementsModule`'s dependency chain via `SearchModule`) that was never caught in any prior phase because no execution sandbox ever had a live DB to get far enough to hit it — every SUMMARY attributed e2e failures to `ECONNREFUSED`/missing `DATABASE_URL`, but two of those e2e specs would fail even with a perfect DB connection. **This verification independently re-proved the underlying behavior these two specs were meant to check via direct live HTTP calls** (see truths 5–13), so it does not block the phase goal, but it should be fixed (add the same `moduleNameMapper` entry from `package.json`'s jest config to `test/jest-e2e.json`) so these two plan-mandated automated verify gates are actually runnable again. |

No debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) found in any file under `apps/api/src` or `apps/web/src`.

### Deferred / Accepted Gaps (already documented — confirmed accurate, not re-flagged)

- `G2BAnnouncementSourceAdapter` remains untested against the live 나라장터 API (공공데이터포털 API 승인 대기 중, per STATE.md Blockers) — confirmed still hardcodes `regionCodes: []`; `deferred-items.md` correctly flags this as the remaining CR-01 follow-up once live region parsing is implemented.
- `NTS_API_KEY` not provisioned — live NTS verification unexercised (confirmed via live log: signup succeeds regardless).
- `RESEND_API_KEY`/`VAPID_*` not provisioned — real Resend/web-push delivery unexercised in this sandbox; `EMAIL_ADAPTER=console` default confirmed live-safe (no outbound Resend call observed).
- `digest_frequency='daily_digest'` has no sender implementation — WR-05 fix added a "준비 중" UI badge (confirmed present in source) rather than shipping the scheduler; this was the review's own accepted second option, not a new gap.
- Participation-eligibility excerpt text always shows "정보 없음" (no schema column yet) — documented known stub from 02-06, correctly out of this phase's scope.

## Human Verification Required

See frontmatter `human_verification` — 6 items, all requiring actual browser interaction
(visual layout, Service-Worker offline behavior, Notification permission prompts, confirm
dialogs, sessionStorage-based masking on tab revisit). None of these are things static
analysis or an HTTP client can observe; the API-level and data-level behavior underlying every
one of them has been independently confirmed live in this verification session.

## Gaps Summary

No blocking gaps. All 4 roadmap Success Criteria and all 12 requirement IDs (PROF-01~05,
ING-01~04, MATCH-01~03, CLIENT-01) are independently confirmed working against a real
PostgreSQL/Redis/Meilisearch stack, not just unit tests with fake Prisma. The phase goal —
"매칭·알림 기능 하나로 '받고 싶은 조달을 놓치지 않는다'는 핵심 가치를 완결시킨다" — is
demonstrably achieved: a company can sign up, register a classification code and region, get
automatically matched and scored against seeded announcements (including the region-match
bonus, confirmed live after the CR-01 fix), receive an idempotent email notification log entry,
and search/filter that same data through a real search engine — all through the actual running
NestJS server, not mocks.

One genuine, previously-undiscovered regression was found and is flagged as a WARNING (not a
blocker, since its underlying behavior was independently re-verified): `test/jest-e2e.json` is
missing the `meilisearch` `moduleNameMapper` entry that `package.json`'s unit-test jest config
already has, breaking `tracer.e2e-spec.ts` and `classification-codes.e2e-spec.ts` — the two
plan-mandated automated `<verify>` commands for 02-02 and 02-04 — independent of database
availability. This should be fixed as a fast follow so the phase's own regression-test safety
net is restored.

The remaining open items are all genuinely browser-only UI/UX checks (visual layout, permission
dialogs, offline caching, session-based masking) that no amount of server-side testing can
substitute for, plus externally-gated items (나라장터/국세청/Resend/VAPID live credentials) that
are correctly documented as accepted, out-of-sandbox gaps rather than code defects.

---

_Verified: 2026-08-27T04:54:46Z_
_Verifier: Claude (gsd-verifier)_
