# Phase 02-mvp — Deferred Items

Out-of-scope discoveries logged during plan execution (not fixed — see SCOPE BOUNDARY in
execute-plan.md deviation rules). Each item is pre-existing from an earlier plan in this phase
and outside the current plan's task boundaries.

## From 02-06

**1. `companies.region_codes` and `bid_announcements.region_codes` use incompatible value formats.**
**Status: fixed (02-REVIEW.md CR-01, applied via /gsd-code-review --fix).**
- **Discovered during:** 02-06 Task 1 (GET /feed region filter implementation).
- **What:** `apps/web/src/components/onboarding/RegionStep.tsx` (02-04) stores companies'
  `region_codes` as full Korean province names (e.g. `"서울특별시"`). The ingestion fixtures
  (`apps/api/tests/fixtures/announcements.sample.json`, 02-01/02-05) previously stored
  `bid_announcements.region_codes` as short numeric codes (e.g. `"11"`, `"48"`) instead —
  `MatchingService.scoreMatch()`'s region-overlap check
  (`company.regionCodes.some((r) => announcement.regionCodes.includes(r))`) compares these two
  formats directly, so the fixtures never actually overlapped with a company's full-name
  `region_codes` (`"서울특별시" !== "11"`), and the +25 regional match bonus and the
  `AnnouncementsService.getFeed()` region filter were silently never applied for fixture-based
  data.
- **Why not fixed in 02-06:** Neither `companies.region_codes` (02-04) nor
  `bid_announcements.region_codes` (02-01/02-05) are 02-06 files, and reconciling the two
  requires a value-mapping decision (province name ↔ numeric code table) that's an architectural
  choice belonging to whichever plan owns the region taxonomy — out of this plan's scope
  (deviation Rule 3 excludes fixing issues not directly caused by the current task's changes).
- **Fix applied:** The canonical representation is now full Korean province names everywhere
  (matching `RegionStep.tsx` and `SearchQueryDto`'s documented contract). All three fixture JSON
  files (`announcements.sample.json`, `announcements.bulk.sample.json`,
  `announcements.revision.sample.json`) were normalized from numeric admin codes to full province
  names. A regression suite (`scoreMatch — 지역 매칭 가점(+25)` in `matching.service.spec.ts`)
  now asserts the +25 regional bonus is actually awarded when representations match, and stays
  unapplied when they don't — this would have caught the original defect, since the prior
  `tracer.e2e-spec.ts` assertion only checked `score > 0`.
- **Remaining follow-up:** `G2BAnnouncementSourceAdapter.parseItem()` still hardcodes
  `regionCodes: []` (not yet implemented — 공공데이터포털 API 승인 대기 중, per STATE.md
  Blockers). When real region-code parsing is added for `ANNOUNCEMENT_SOURCE=g2b`, it must emit
  the same full-province-name representation (or a mapping utility must convert numeric G2B codes
  to it) to stay consistent with this fix — flag for whichever follow-up plan implements live G2B
  region parsing.
