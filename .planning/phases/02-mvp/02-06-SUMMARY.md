---
phase: 02-mvp
plan: 06
subsystem: api
tags: [meilisearch, nestjs, nextjs, search, feed, matching, pwa]

requires:
  - phase: 02-mvp (plan 04)
    provides: GET /companies/me(프로필 조회, profileComplete), 온보딩 업종/지역 등록 UI
  - phase: 02-mvp (plan 05)
    provides: AnnouncementsService.pollAndUpsert()(색인 훅 삽입 지점), MatchingService.scoreMatch/toQualitativeTier, bid_announcements/matches 시드 데이터
provides:
  - "MeilisearchService(indexAnnouncement/searchAnnouncementIds) + SearchModule — ING-04 검색엔진 확정값(meilisearch) 구현"
  - "GET /feed(JWT): keyword/classification/region/deadline/sort/includeExpired/page, matches.company_id 스코프, qualitativeTier만 직렬화(score 필드 없음)"
  - "GET /announcements/:id(JWT): match_id 소유권 검증(403), raw_payload 미노출, 개정 배너용 latestRevisionId"
  - "apps/web 공고 피드 화면(FilterBar/AnnouncementCard/FeedContent) — 무한스크롤, 디바운스, 업종미등록/매칭0건 구분, 오프라인 배지"
  - "apps/web 공고 상세 화면(DetailContent) — above-the-fold 원문 링크, 4개 엣지케이스, 로컬 저장 토글"
  - "sw.js GET /feed 네트워크우선+캐시폴백"
affects: [02-07]

actuals:
  tokens: 23500
  tasks: 2
  commits: 3

tech-stack:
  added:
    - "meilisearch@0.60.0 (RESEARCH.md Package Legitimacy Audit 사전 승인, checkpoint:decision으로 이번 플랜이 최종 확정)"
  patterns:
    - "GET /feed는 matches.findMany({where:{companyId}, include:{announcement:true}})로 업체 범위를 먼저 스코프한 뒤, classification/region/deadline/includeExpired/keyword 교집합을 애플리케이션 레벨 in-memory 필터로 처리한다 — idx_matches_company_id_matched_at 인덱스를 그대로 활용하면서 region_codes 배열 컬럼에 대한 복잡한 SQL 연산자 조합(GIN 인덱스 등)을 피한다."
    - "useSearchParams()/useParams()를 쓰는 페이지는 얇은 서버 컴포넌트(page.tsx, Suspense 래퍼) + 실제 로직을 담은 클라이언트 컴포넌트(FeedContent.tsx/DetailContent.tsx)로 분리한다 — Next.js 16 prerender 요구사항(공식 문서 use-search-params.md §Prerendering)."
    - "Jest가 파싱 못하는 ESM-only npm 패키지(meilisearch)는 jest.moduleNameMapper로 테스트 전용 목(apps/api/src/test-utils/meilisearch.mock.ts)으로 치환한다 — 실제 빌드/런타임 코드는 그대로 두고 테스트 실행 경로만 우회."

key-files:
  created:
    - apps/api/src/search/meilisearch.service.ts
    - apps/api/src/search/search.module.ts
    - apps/api/src/test-utils/meilisearch.mock.ts
    - apps/api/src/announcements/dto/search-query.dto.ts
    - apps/api/src/announcements/announcements.controller.ts
    - apps/api/src/announcements/announcements.controller.spec.ts
    - apps/web/src/app/feed/FeedContent.tsx
    - apps/web/src/components/feed/FilterBar.tsx
    - apps/web/src/components/feed/AnnouncementCard.tsx
    - apps/web/src/app/announcements/[id]/page.tsx
    - apps/web/src/app/announcements/[id]/DetailContent.tsx
  modified:
    - docker-compose.yml
    - env.example
    - apps/api/package.json
    - package-lock.json
    - apps/api/src/announcements/announcements.service.ts
    - apps/api/src/announcements/announcements.module.ts
    - apps/api/src/announcements/announcements.service.spec.ts
    - apps/web/src/app/feed/page.tsx
    - apps/web/src/lib/api-client.ts
    - apps/web/public/sw.js

key-decisions:
  - "checkpoint:decision 사전 확정값(meilisearch)을 재확인 없이 그대로 구현 — orchestrator 세션에서 이미 결정됨(RESEARCH.md 권장안)."
  - "GET /feed의 classification/region/deadline/includeExpired 필터를 SQL WHERE 절이 아니라 matches.findMany() 결과에 대한 in-memory 필터로 구현 — keyword만 Meilisearch를 거친다. MVP 규모(업체당 매칭 건수가 이미 prefix로 좁혀진 상태)에서 테스트·유지보수가 더 쉽다고 판단(db-schema-design.md §Phase 2 인계 사항 7의 GIN 인덱스 보류 판단과 같은 취지)."
  - "참가자격 원문 발췌 영역은 항상 '정보 없음'을 표시 — bid_announcements 스키마에 해당 텍스트를 담을 컬럼이 없다(db-schema-design.md 8테이블 어디에도 없음). 신규 컬럼 추가는 Rule 4(아키텍처 변경) 대상이라 이번 플랜에서 임의로 스키마를 바꾸지 않고 스텁으로 남김(WINDOWS.md #10)."
  - "나라장터 원문 링크 URL은 공식 문서 미확인 상태로 [ASSUMED] 표기 후 구현 — g2b-announcement-source.adapter.ts의 API 필드명 미확정과 동일 성격의 갭(WINDOWS.md #12)."
  - "companies.region_codes(전체 시도명)와 bid_announcements.region_codes(숫자코드)의 값 형식 불일치를 발견했으나 이번 플랜(02-06) 파일 범위 밖(02-01/02-04/02-05 소관)이라 고치지 않고 deferred-items.md + WINDOWS.md #11에 기록만 함(Rule 3 SCOPE BOUNDARY)."
  - "GET /feed와 GET /announcements/:id는 플랜의 files_modified가 이미 announcements.controller.ts를 두 태스크 모두에 걸쳐 있다고 명시했지만, 헬퍼 함수(findBestMatchingPrefix/buildMatchReason/CLASSIFICATION_LABELS)를 공유하는 한 파일이라 실제로는 한 번에 작성한 뒤 getDetail 관련 코드만 임시로 제거·재추가하는 방식으로 두 개의 원자적 커밋으로 분리했다."

patterns-established:
  - "검색엔진 조회는 keyword 전용 경로로만 쓰고, 구조화된 필터(분류/지역/마감일)는 애플리케이션 레벨에서 처리한다 — Meilisearch 인덱스에 필터 가능한 필드를 추가로 설정하지 않아도 된다."
  - "누구나 접근 가능한 리소스(bid_announcements)와 업체별 소유 리소스(matches)를 구분해 상세 조회 시 전자는 404 대신 found:false로, 후자는 명시적 403(ForbiddenException)으로 응답한다."

requirements-completed: [ING-04, MATCH-01, CLIENT-01]

coverage:
  - id: D1
    description: "로그인한 업체는 키워드·업종·지역·마감일로 자신의 매칭 공고를 검색·필터링할 수 있다"
    requirement: ING-04
    verification:
      - kind: unit
        ref: "apps/api/src/announcements/announcements.controller.spec.ts#GET /feed (키워드/classification/region/deadline/includeExpired 필터 케이스 전체)"
        status: pass
    human_judgment: false
  - id: D2
    description: "피드 카드는 적합도를 5단계 정성 등급으로만 표시하고, 원점수·백분율은 어디에도 노출되지 않는다"
    requirement: MATCH-01
    verification:
      - kind: unit
        ref: "apps/api/src/announcements/announcements.controller.spec.ts#GET /feed 응답 JSON 어디에도 score/원점수 숫자 필드가 없다"
        status: pass
    human_judgment: false
  - id: D3
    description: "다른 업체의 match_id로 상세에 접근하면 403이 반환된다"
    requirement: CLIENT-01
    verification:
      - kind: unit
        ref: "apps/api/src/announcements/announcements.controller.spec.ts#다른 업체 소유의 match_id로 상세 조회 시 403(ForbiddenException)이 발생한다"
        status: pass
    human_judgment: false
  - id: D4
    description: "공고 상세 화면에는 나라장터 원문 링크가 스크롤 없이 보이는 위치(above the fold)에 항상 존재하고, 마감·개정·파싱실패·취소삭제 4개 엣지 케이스가 렌더링된다"
    requirement: CLIENT-01
    verification: []
    human_judgment: true
    rationale: "레이아웃(above-the-fold)과 4개 엣지 케이스의 실제 렌더링은 시각적 확인이 필요한 사항이다. 이 실행 환경에 Docker/PostgreSQL/Redis/Meilisearch가 없어(WINDOWS.md #1/#3/#4/#8과 동일 갭) 로그인 후 실 데이터로 화면을 띄워볼 수 없었다 — next build(TypeScript+컴파일)는 성공했고 코드 리뷰로 4개 분기(isExpired 배지/!isLatestRevision 배너/hasParsingGaps 강조/found:false 최소렌더링)가 모두 존재함을 확인했다(WINDOWS.md #9)."
  - id: D5
    description: "네트워크가 끊겨도 마지막으로 불러온 피드가 캐시에서 표시된다"
    requirement: ING-04
    verification: []
    human_judgment: true
    rationale: "sw.js의 Cache Storage 폴백 로직은 표준 API 패턴대로 구현했으나 실제 서비스워커 런타임(브라우저)에서 오프라인 시나리오를 재현해 검증하지 못했다(WINDOWS.md #13) — 이 환경에 로그인 가능한 실행 중인 앱이 없다."

duration: ~70min
completed: 2026-08-27
status: complete
---

# Phase 2 Plan 6: 검색·피드·상세 화면 Summary

**Meilisearch 검색 색인 + GET /feed(키워드·업종·지역·마감일 필터, 무한스크롤 피드 화면) + GET /announcements/:id(소유권 검증·403, 4개 엣지케이스 상세 화면) — 매칭 원점수는 API 응답 스키마 자체에서 제거해 노출 경로를 원천 차단**

## Performance

- **Duration:** ~70 min (근사치 — 세션 시작 시각 마커가 기록되지 않아 커밋 타임스탬프 간격 기준 추정)
- **Started:** 2026-08-27T00:05:00Z (추정)
- **Completed:** 2026-08-27T00:20:13Z
- **Tasks:** 2 (tracer × 1, auto × 1) + checkpoint:decision 1개(사전 확정값으로 재확인 없이 통과)
- **Files modified:** 21 (신규 11, 수정 10)

## Accomplishments

- **검색엔진 확정(meilisearch) + 색인 파이프라인**: `docker-compose.yml`에 meilisearch 서비스 추가, `meilisearch@0.60.0` 설치, `MeilisearchService.indexAnnouncement()`/`searchAnnouncementIds()` 구현. `AnnouncementsService.upsertOne()`이 create/update 직후 `indexForSearch()`를 호출해 수집과 색인이 항상 동기화되게 함(색인 실패는 흡수되어 배치 파이프라인을 막지 않음).
- **GET /feed**: `matches.company_id = 로그인 업체`로 항상 스코프(idx_matches_company_id_matched_at 인덱스 재사용) → keyword는 Meilisearch 후보 id 교집합, classification/region/deadline/includeExpired는 in-memory 필터, score/deadline/latest 3가지 정렬, 페이지네이션(hasMore). 응답 DTO(`FeedItemDto`)에는 `score` 필드 자체가 존재하지 않아 실수로도 원점수가 흘러나갈 수 없다(T-02-13).
- **GET /announcements/:id**: `match_id` 쿼리(이메일 알림 경로)의 소유권을 검증해 불일치 시 403(T-01-16), 공고 자체가 없으면(취소·삭제) 404 대신 `found:false`로 200 응답해 프론트가 별도 에러 경계 없이 안내 문구를 렌더링, `raw_payload`는 절대 직렬화하지 않고 정규화된 필드+매칭근거만 반환.
- **공고 피드 화면**(`FilterBar`/`AnnouncementCard`/`FeedContent`): 키워드+Enter/검색버튼, 업종 다중선택(등록 prefix + 임시 추가), 지역 다중선택, 마감일(이번주/이번달), 정렬, "마감된 공고 포함" 토글, 필터 초기화. URL 쿼리스트링에 필터 상태 반영(디바운스 400ms), IntersectionObserver 기반 무한스크롤, 업종 미등록/매칭 0건을 별도 안내문구+온보딩 링크로 구분, 로딩 스켈레톤, `sw.js` 캐시 응답 여부에 따른 오프라인 배지.
- **공고 상세 화면**(`DetailContent`): 헤더 바로 아래 원문 링크 버튼(above-the-fold), 핵심 요약표, 참가자격 발췌(접기/펼치기, 데이터 없음 고지), 매칭 근거 자세히보기, "이 공고 저장"(localStorage 토글+토스트), "이 업종 알림 조정하기"(→`/settings/notifications?from=detail&hint=`), Legal 고지 문구 고정 배치, 4개 엣지케이스(마감/개정/파싱실패/취소삭제) 분기 렌더링.
- **sw.js**: `GET /feed` 네트워크우선+Cache Storage 폴백, 캐시 응답에 `x-jodalmate-cache: hit` 헤더를 추가해 프론트가 오프라인 배지를 표시할 수 있게 함.

## Task Commits

1. **Tracer: 검색 색인·API + 공고 피드 화면 end-to-end** - `90be231` (feat)
2. **공고 상세 화면 — 원문 링크·매칭 근거·엣지 케이스** - `261ced4` (feat)
3. **테스트 커버리지 보강(classification/deadline 필터)** - `afba4b4` (test, 계획에 없던 추가 커밋 — 두 태스크 모두의 GET /feed 로직 정확성 강화)

**Plan metadata:** (이 커밋, 워크트리 모드 — STATE.md/ROADMAP.md는 오케스트레이터가 병합 후 갱신)

## Tracer Feedback Gate

Task 1(`type="tracer"`) 커밋 직후 `<verify>`(`npm run test --workspace=apps/api -- announcements.controller.spec.ts`)를 재실행했다 — 8개 테스트 모두 통과. 통과를 확인한 뒤 Task 2(상세 화면)로 진행했다.

## Files Created/Modified

- `apps/api/src/search/meilisearch.service.ts` — indexAnnouncement/searchAnnouncementIds
- `apps/api/src/search/search.module.ts` — SearchModule
- `apps/api/src/test-utils/meilisearch.mock.ts` — Jest 전용 ESM 패키지 목
- `apps/api/src/announcements/dto/search-query.dto.ts` — GET /feed 쿼리 DTO
- `apps/api/src/announcements/announcements.controller.ts` — GET /feed, GET /announcements/:id
- `apps/api/src/announcements/announcements.controller.spec.ts` — 15개 단위테스트
- `apps/api/src/announcements/announcements.service.ts` — getFeed/getDetail + 색인 훅
- `apps/api/src/announcements/announcements.module.ts` — SearchModule import, 컨트롤러 배선
- `apps/api/src/announcements/announcements.service.spec.ts` — 생성자 시그니처 변경(searchService 인자) 반영
- `apps/web/src/app/feed/page.tsx`, `FeedContent.tsx` — 피드 화면
- `apps/web/src/components/feed/FilterBar.tsx`, `AnnouncementCard.tsx`
- `apps/web/src/app/announcements/[id]/page.tsx`, `DetailContent.tsx` — 상세 화면
- `apps/web/src/lib/api-client.ts` — getFeed/getAnnouncementDetail/저장 토글 헬퍼
- `apps/web/public/sw.js` — GET /feed 캐싱
- `docker-compose.yml`, `env.example`, `apps/api/package.json`, `package-lock.json`

## Decisions Made

체크포인트 태스크(검색엔진 선택)는 오케스트레이터 세션에서 이미 meilisearch로 확정되어 재확인 없이 진행했다. 실행 중 내린 기술적 결정은 위 frontmatter `key-decisions`에 기록.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `meilisearch` 패키지의 named export가 `Meilisearch`(대문자 M, 소문자 s)임을 발견 — 계획/RESEARCH.md 예시 코드의 `MeiliSearch` 표기와 다름**
- **Found during:** Task 1, `npm run build` 중 TS2724 에러
- **Issue:** `import { MeiliSearch } from 'meilisearch'`가 컴파일 에러 — 실제 export명은 `Meilisearch`
- **Fix:** import/사용처를 `Meilisearch`로 수정
- **Files modified:** apps/api/src/search/meilisearch.service.ts
- **Verification:** `npm run build --workspace=apps/api` 통과
- **Committed in:** 90be231

**2. [Rule 3 - Blocking] `meilisearch` npm 패키지가 ESM 전용(CJS 빌드 없음)이라 Jest가 파싱하지 못함**
- **Found during:** Task 1, `announcements.controller.spec.ts` 최초 실행 시 `SyntaxError: Unexpected token 'export'`
- **Issue:** Node 24 런타임은 `require()`로 ESM을 네이티브 로드할 수 있어 실제 빌드/실행에는 문제가 없음(직접 확인: `node -e "require('meilisearch')"` 성공)이지만, Jest의 자체 모듈 로더는 이 기능을 쓰지 않아 테스트 스위트 전체가 파싱 단계에서 실패했다
- **Fix:** `apps/api/src/test-utils/meilisearch.mock.ts`(테스트 전용 최소 목)를 만들고 `package.json`의 `jest.moduleNameMapper`로 `meilisearch` import를 테스트 실행 중에만 이 목으로 치환. 프로덕션 빌드/런타임 코드는 변경 없음
- **Files modified:** apps/api/src/test-utils/meilisearch.mock.ts(신규), apps/api/package.json(jest.moduleNameMapper 추가)
- **Verification:** `npm run test --workspace=apps/api` 전체 스위트 통과(37개)
- **Committed in:** 90be231

**3. [Rule 3 - Blocking] `useSearchParams()`를 쓰는 페이지가 Next.js 16 prerender 시 Suspense 경계 없이는 빌드 경고/실패 대상**
- **Found during:** Task 1, `feed/page.tsx` 설계 중(Next.js 공식 문서 `use-search-params.md §Prerendering` 확인)
- **Issue:** 계획에 명시되지 않았으나, App Router에서 `useSearchParams()`를 직접 쓰는 페이지는 Suspense로 감싸지 않으면 prerender 시 클라이언트 트리 전체가 CSR로 강등되거나 빌드 경고가 발생한다
- **Fix:** `page.tsx`를 얇은 서버 컴포넌트(Suspense 래퍼)로, 실제 로직은 별도 클라이언트 컴포넌트(`FeedContent.tsx`/`DetailContent.tsx`)로 분리
- **Files modified:** apps/web/src/app/feed/page.tsx, FeedContent.tsx(신규), apps/web/src/app/announcements/[id]/page.tsx(신규), DetailContent.tsx(신규)
- **Verification:** `next build` 성공(정적 페이지로 최적화됨, `/announcements/[id]`는 동적 라우트로 정상 분류)
- **Committed in:** 90be231, 261ced4

**4. [Rule 1 - Bug] `react-hooks` lint 규칙이 effect 본문 내 동기 `setState` 호출을 금지 — `isAnnouncementSaved()` 초기 읽기 패턴 수정**
- **Found during:** Task 2, `DetailContent.tsx` lint 검사
- **Issue:** `useEffect` 안에서 `setSaved(isAnnouncementSaved(params.id))`를 동기 호출하면 `react-hooks/set-state-in-effect` 에러 발생(캐스케이딩 렌더 위험)
- **Fix:** localStorage를 매 렌더마다 직접 읽는 방식(`saved = isAnnouncementSaved(params.id)`)으로 바꾸고, 토글 후 재렌더만 트리거하는 `saveVersion` 카운터를 도입해 effect 자체를 없앰
- **Files modified:** apps/web/src/app/announcements/[id]/DetailContent.tsx
- **Verification:** `eslint` 클린, `next build` 통과
- **Committed in:** 261ced4

---

**Total deviations:** 4 auto-fixed (모두 Rule 3 블로킹 이슈 해소 + Rule 1 lint 버그 수정)
**Impact on plan:** 아키텍처 변경(Rule 4 대상)은 없었다. 모두 빌드·테스트를 통과시키는 데 필수적인 수정이었다.

## Issues Encountered

**Docker/PostgreSQL/Redis/Meilisearch가 이 실행 환경에 여전히 없음(02-01부터 이어짐)** — 위 coverage D4/D5 및 WINDOWS.md #9/#13 참고. 단위테스트(fake Prisma + mock MeilisearchService)로 로직을, `next build`/`nest build`로 타입·컴파일을 검증했으나 실제 브라우저·서비스워커·데이터베이스가 관여하는 시나리오는 검증하지 못했다.

**`apps/web`에 node_modules가 없어(WINDOWS.md #5와 동일 갭 예상)** `npm install --workspace=apps/web`을 직접 실행해 설치했다 — 설치 후에는 `next build`가 정상 동작했다(이전 플랜의 심볼릭 링크 문제는 이번 실행에서는 재현되지 않음, 인프라 상태에 따라 달라지는 것으로 보임).

## User Setup Required

02-01~02-05-SUMMARY.md의 "User Setup Required"에 이어 — Docker Desktop(Windows, WSL2 backend) 설치 시 아래 항목도 함께 확인 필요:

1. `docker-compose up -d`로 meilisearch 서비스가 정상 기동하는지, `env.example`의 `MEILI_MASTER_KEY`가 `docker-compose.yml`의 값과 일치하는지 확인
2. 로그인 후 `/feed`, `/announcements/:id`를 실제 브라우저에서 열어 4개 상세 엣지케이스(WINDOWS.md #9)와 오프라인 캐시 폴백(WINDOWS.md #13)을 수동 확인
3. `buildSourceUrl()`의 나라장터 딥링크 URL(WINDOWS.md #12)이 실제로 유효한 공고 상세 페이지로 연결되는지 활용신청 승인 후 재확인

## Known Stubs

- **참가자격 원문 발췌 영역이 항상 "정보 없음"만 표시** — `apps/web/src/app/announcements/[id]/DetailContent.tsx`. `bid_announcements` 스키마(db-schema-design.md)에 해당 텍스트를 담을 컬럼이 없다(원문은 `raw_payload`에만 있고 이 화면은 그것을 통째로 노출하지 않는다). 신규 컬럼 추가는 스키마 변경(Rule 4)이라 이번 플랜에서 다루지 않았다. WINDOWS.md #10에 기록. 향후 파싱 도입 플랜이 해소해야 함.

## Threat Flags

없음 — 이번 플랜이 새로 여는 표면(GET /feed, GET /announcements/:id)은 모두 계획의 `<threat_model>`(T-02-12/T-02-13/T-02-14)이 이미 다뤘고, 대응(소유권 검증 403, score 필드 제거, Meilisearch를 API 경유로만 호출)을 그대로 구현했다.

## Next Phase Readiness

- ING-04(검색·필터)·CLIENT-01(피드·상세 화면)이 실 데이터로 완성되어, 02-07(알림 발송·알림 설정 화면)이 "이 업종 알림 조정하기" 링크(`/settings/notifications?from=detail&hint={prefix}`)가 실제로 도착할 목적지 화면을 만들 준비가 됨
- **인계 사항 1 — region_codes 값 형식 불일치(deferred-items.md, WINDOWS.md #11)**: `ANNOUNCEMENT_SOURCE=g2b` 전환 전 companies/bid_announcements 간 지역 코드 매핑 테이블이 필요하다. 지금(fixture 전용 운영)은 영향이 보이지 않지만 실 데이터 연동 시 지역 매칭이 항상 실패하는 잠재 버그다.
- **인계 사항 2 — 참가자격 텍스트 컬럼 부재(Known Stubs)**: 03-detail.md가 요구하는 참가자격 발췌 기능을 실제로 채우려면 `bid_announcements`에 새 컬럼과 파싱 로직이 필요하다(별도 플랜 과제).
- **차단 사항 — Docker/Redis/Meilisearch 설치 대기(02-01부터 이어짐)**: 위 "User Setup Required" 참고.

---
*Phase: 02-mvp*
*Plan: 06*
*Completed: 2026-08-27*

## Self-Check: PASSED

All key files verified present on disk, commit hashes verified in git log:
- `apps/api/src/search/meilisearch.service.ts` — FOUND
- `apps/api/src/search/search.module.ts` — FOUND
- `apps/api/src/test-utils/meilisearch.mock.ts` — FOUND
- `apps/api/src/announcements/dto/search-query.dto.ts` — FOUND
- `apps/api/src/announcements/announcements.controller.ts` — FOUND
- `apps/api/src/announcements/announcements.controller.spec.ts` — FOUND
- `apps/web/src/app/feed/FeedContent.tsx` — FOUND
- `apps/web/src/components/feed/FilterBar.tsx` — FOUND
- `apps/web/src/components/feed/AnnouncementCard.tsx` — FOUND
- `apps/web/src/app/announcements/[id]/page.tsx` — FOUND
- `apps/web/src/app/announcements/[id]/DetailContent.tsx` — FOUND
- `.planning/phases/02-mvp/deferred-items.md` — FOUND
- Commit `90be231` — FOUND in `git log`
- Commit `261ced4` — FOUND in `git log`
- Commit `afba4b4` — FOUND in `git log`
- `npm run test --workspace=apps/api`: 8 suites / 37 tests — all PASSED
- `npm run build --workspace=apps/api`: PASSED
- `npm run build --workspace=apps/web` (`next build`): PASSED (Turbopack, `/announcements/[id]` correctly classified as dynamic route)
- `eslint` (both workspaces): 0 errors
