# Phase 02-mvp — Deferred Items

Out-of-scope discoveries logged during plan execution (not fixed — see SCOPE BOUNDARY in
execute-plan.md deviation rules). Each item is pre-existing from an earlier plan in this phase
and outside the current plan's task boundaries.

## From 02-06

**1. `companies.region_codes` and `bid_announcements.region_codes` use incompatible value formats.**
- **Discovered during:** 02-06 Task 1 (GET /feed region filter implementation).
- **What:** `apps/web/src/components/onboarding/RegionStep.tsx` (02-04) stores companies'
  `region_codes` as full Korean province names (e.g. `"서울특별시"`). The ingestion fixtures
  (`apps/api/tests/fixtures/announcements.sample.json`, 02-01/02-05) and
  `G2BAnnouncementSourceAdapter` store `bid_announcements.region_codes` as short numeric codes
  (e.g. `"11"`, `"48"`). `MatchingService.scoreMatch()`'s region-overlap check
  (`company.regionCodes.some((r) => announcement.regionCodes.includes(r))`) compares these two
  incompatible formats directly, so real region-based matching/scoring never actually overlaps
  once live G2B data starts flowing in (`"서울특별시" !== "11"`).
- **Why not fixed in 02-06:** Neither `companies.region_codes` (02-04) nor
  `bid_announcements.region_codes` (02-01/02-05) are 02-06 files, and reconciling the two
  requires a value-mapping decision (province name ↔ numeric code table) that's an architectural
  choice belonging to whichever plan owns the region taxonomy — out of this plan's scope
  (deviation Rule 3 excludes fixing issues not directly caused by the current task's changes).
- **Impact today:** Currently invisible — `ANNOUNCEMENT_SOURCE=fixture` fixtures happen to be
  crafted so 02-06's own tests use consistent formats within each test's fixture set, and
  `region_codes.length === 0` (전국/no region restriction) still grants the +15 partial score
  regardless of format. It becomes a real bug only once `ANNOUNCEMENT_SOURCE=g2b` is activated
  (blocked today on 공공데이터포털 API 승인, per STATE.md Blockers) and real announcements start
  carrying non-empty `region_codes`.
- **Recommendation:** Before `ANNOUNCEMENT_SOURCE=g2b` goes live, add a mapping table
  (province name → 시/도 numeric code, or normalize both sides to one representation) and update
  `MatchingService`'s region-overlap check + `AnnouncementsService.getFeed()`'s region filter to
  use it. Flag for the phase owner (or a dedicated follow-up plan) — not urgent for MVP fixture-only
  operation, but must land before real ingestion is switched on.
