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
  `regionCodes: []`. Live API access was approved 2026-08-27 (see item 2 below) — a live sample
  of `getBidPblancListInfoServc` responses showed no populated region-restriction field on the
  records checked (`rgnLmtBidLocplcJdgmBssNm` and similar fields were empty strings); a
  participation-region field may exist on a different endpoint or only populate for
  region-restricted bids. Needs a live sample that actually has a region restriction before a
  mapping utility can be written — flag for whichever follow-up plan implements live G2B region
  parsing.

## From live G2B verification (post-phase, 2026-08-27)

**2. 나라장터 API 승인 완료 — 실제 연동 라이브 검증함, `classificationCode`는 이 엔드포인트에
   존재하지 않음이 확인됨.**
- **Discovered during:** Phase 02 UAT 이후, 사용자가 승인받은 실제 `NARAJANGTEO_API_KEY`로
  라이브 검증(커밋 8c870be — 필수 파라미터 3개 누락, 에러 응답 형태 불일치, 원문 링크 패턴
  오류를 모두 발견·수정, 실제 공고 100건 수집 확인).
- **확정된 사실:** `getBidPblancListInfoServc` 응답에는 물품분류번호(`prdctClsfcNo` 또는 동등
  필드)가 없다 — 가정이 아니라 실측 확인. `classificationCode`는 이 어댑터에서 항상 `null`을
  반환하도록 이미 수정함(추측성 필드 매핑 제거).
- **영향:** `classificationCode`가 `null`이면 `MatchingService`의 업종 매칭(스파인 조인)이
  스킵된다(db-schema-design.md §스파인) — 즉 `ANNOUNCEMENT_SOURCE=g2b`로 전환한 실제 운영에서는
  지금 상태로는 업종 기반 매칭이 전혀 동작하지 않는다. **MVP 핵심 가치(업종 매칭)에 직결되는
  높은 우선순위 후속 작업.**
- **다음 단계 제안(구현 안 함 — 범위 밖):** 사전규격정보서비스 등 물품분류번호를 제공하는
  별도 나라장터 API 연동 검토, 또는 공고명(`bidNtceNm`) 텍스트 기반 분류 추정(정확도 낮음).
  실제 API 승인이 이번에 처음 확인된 것이므로 이 결정은 다음 세션에서 사람 판단 필요.
