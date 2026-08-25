---
phase: 01-prep
plan: 02
subsystem: design-docs
tags: [unspsc, g2b, 나라장터, 물품분류번호, 매핑-설계, procurement-classification]

# Dependency graph
requires:
  - phase: 01-prep (같은 phase, 01-01 CONTEXT/RESEARCH)
    provides: D-06/D-07/D-08 결정, UNSPSC 두 코드 체계 구분 리서치
provides:
  - "업종-물품분류 매핑 설계 문서 (docs/design/업종-물품분류-매핑.md, 7개 섹션)"
  - "3개 코드 체계(국세청 업태·종목/G2B 참가자격 업종코드/물품분류번호) 구분표"
  - "목표 업종 4개 중 3개(정보통신·SW/사무용품/인쇄·출판)의 실제 물품분류번호 확인, 1개(시설관리) 미확인 문서화"
  - "프로필 저장 형식 권장안(가변 자릿수 prefix)과 Phase 2 매칭 규칙 초안"
affects: [phase-2-mvp-schema, phase-2-onboarding-ui, phase-2-matching-engine]

# Actuals (#2632)
actuals:
  tokens: 4025
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns: ["[확인]/[미확인] 검증 상태 태깅 — 리서치 추정치를 실조회 없이 사실로 승격하지 않는 문서 관례"]

key-files:
  created: ["docs/design/업종-물품분류-매핑.md"]
  modified: []

key-decisions:
  - "물품분류번호(UNSPSC 기반, 최대 8자리)를 업체 프로필-공고 매칭의 1차 조인 키로 확정 (D-06 문서화)"
  - "PROF-01 요구사항 문구('업종코드')와 실제 저장 값(물품분류번호)의 용어 불일치를 명시적으로 경고"
  - "프로필 저장은 8자리 고정이 아니라 2/4/6/8자리 가변 prefix 다중 선택 방식을 권장 — 플랜 03 스키마의 VARCHAR(8) 고정 컬럼 가정을 수정해야 함을 인계"
  - "정보통신·소프트웨어개발(43)/사무용품(44)/인쇄·출판(55)은 검색엔진에 색인된 나라장터 실제 물품 목록 타이틀로 확인, 시설관리(72/76 추정)는 확인하지 못해 [미확인]으로 남김"

patterns-established:
  - "코드 체계 구분표: 목적/적용대상/형식·자릿수/조회처/사용여부 컬럼으로 세 체계를 표에서 물리적으로 분리"

requirements-completed: [SC-2]

coverage:
  - id: D1
    description: "업종-물품분류 매핑 설계 문서 7개 섹션(결론/코드체계구분/목표업종매핑표/미확인항목/저장형식권장안/매칭규칙/범위밖) 작성, 목표 업종 4개 중 3개 실조회 확인"
    requirement: "SC-2"
    verification:
      - kind: other
        ref: "grep 기반 automated verify — 7개 h2 섹션 존재, D-06/D-07/D-08 인용, UNSPSC·goods.g2b.go.kr 등장, [확인]/[미확인] 8회, 8자리 코드 10회 등장 (plan 01-02-PLAN.md Task 1·2 <automated> 게이트 전부 PASS)"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-08-25
status: complete
---

# Phase 1 Plan 2: 업종-물품분류 매핑 설계 Summary

**나라장터 세 코드 체계(국세청 업태·종목/G2B 참가자격 업종코드/UNSPSC 물품분류번호)를 표로 분리하고, 목표 업종 4개 중 3개(정보통신·SW=43, 사무용품=44, 인쇄·출판=55)의 실제 코드를 검색엔진에 색인된 나라장터 실물 목록 타이틀로 확인해 매핑 설계 문서로 남김**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-25T13:42:13Z
- **Completed:** 2026-08-25T13:57:00Z (approx)
- **Tasks:** 2/2
- **Files modified:** 1 (`docs/design/업종-물품분류-매핑.md` — Task 1과 Task 2가 같은 파일에 순서대로 섹션을 이어 붙임, 단일 커밋으로 완결)

## Accomplishments
- 세 가지 코드 체계(국세청 업태·종목 / 나라장터 참가자격 업종코드 / 물품분류번호) 구분표 작성 — RESEARCH.md Pitfall 1(코드 혼동) 차단
- 목표 업종 4개(정보통신·소프트웨어개발/사무용품/시설관리/인쇄·출판) 매핑표 작성. 이 중 3개는 검색엔진에 색인된 나라장터 국가종합전자조달 실제 물품 목록 타이틀로 코드값을 직접 확인(`[44121511]우편함`, `[551015]인쇄출판물`, NETBID 가이드의 정보통신 하드웨어 10자리 코드 다수)했고, 시설관리 1개는 확인하지 못해 `[미확인]`으로 남김
- 프로필 저장 형식(대분류/중분류 다중 선택, 가변 2/4/6/8자리 prefix)과 매칭 규칙(prefix 일치 + 자릿수 가중치, 점수 수식은 Phase 2로 위임) 서술
- KSIC 이중 매핑(D-07)·전체 분류체계 매핑·참가자격 업종코드 기반 자격판별(Phase 4)을 명시적으로 범위 밖 선언

## Task Commits

Task 1과 Task 2는 같은 파일(`docs/design/업종-물품분류-매핑.md`)의 앞 4개 섹션과 뒤 3개 섹션을 순서대로 작성하는 단일 산출물이라, 하나의 커밋으로 원자적으로 커밋했다(두 태스크 모두 이 커밋으로 완료 상태 확인됨 — 아래 self-check 참고).

1. **Task 1+2: 업종-물품분류 매핑 설계 문서 7개 섹션 작성** - `1078035` (feat)

## Files Created/Modified
- `docs/design/업종-물품분류-매핑.md` - 업종-물품분류 매핑 설계 문서, 7개 h2 섹션(결론 먼저 / 세 가지 코드 체계 구분 / 목표 업종 매핑표 / 미확인 항목과 확인 방법 / 프로필 저장 형식 권장안 / 매칭 규칙 / 이번 Phase 범위 밖)

## Decisions Made
- 물품분류번호를 1차 조인 키로 삼는 D-06을 문서 최상단 "결론 먼저" 섹션에서 근거와 함께 단정적으로 재확인
- PROF-01 요구사항 문구("업종코드")와 실제 저장 값(물품분류번호)의 용어 불일치를 Phase 2 planner를 위해 명시적으로 경고
- 프로필 저장 형식은 8자리 고정이 아니라 대분류(2)/중분류(4) 단위 다중 선택 + 가변 길이 prefix 저장을 권장 — 이는 RESEARCH.md 초안 스키마 스케치의 `classification_code VARCHAR(8)` 고정 가정을 수정해야 함을 플랜 03에 인계하는 결정
- 매칭 규칙은 prefix 일치 + 자릿수별 가중치 방향성만 문서화하고, 구체적 점수 수식은 Phase 2에서 확정하도록 명시적으로 위임(이 문서는 조인 키 설계 문서이지 스코어링 알고리즘 설계 문서가 아님)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - 발견 보강] 물품분류번호(8자리) vs 물품목록번호(10자리) 구조 보정 설명 추가**
- **Found during:** Task 1 (코드 체계 구분표 실조회 중)
- **Issue:** RESEARCH.md는 물품분류번호를 "8자리"로만 설명했으나, 실조회 과정에서 나라장터 실무에 "물품분류번호(8자리) + 물품식별번호(2자리) = 물품목록번호(10자리)"라는 세부 구조가 있음을 발견(tistory 블로그, NETBID 가이드 교차 확인). 이 구조를 모르면 Phase 2가 10자리 코드를 8자리 물품분류번호로 오인해 prefix 매칭 로직을 잘못 짤 수 있음
- **Fix:** §세 가지 코드 체계 구분 하단에 "참고 — 세부 자릿수 보정" 문단을 추가해 8자리 물품분류번호와 10자리 물품목록번호의 관계를 명시하고, D-06이 조인 키로 삼는 것은 8자리 이내 물품분류번호임을 재확인
- **Files modified:** docs/design/업종-물품분류-매핑.md
- **Verification:** 문서 재검토로 8자리/10자리 혼동 가능성이 해소됨을 확인
- **Committed in:** 1078035 (단일 커밋에 포함)

---

**Total deviations:** 1 auto-fixed (Rule 2 - 발견 보강, 스코프 내 정보 보강이며 새 아키텍처 결정은 아님)
**Impact on plan:** 문서 정확성을 높이는 보강이며 계획 범위·산출물 구조를 벗어나지 않음. 스코프 크리프 없음.

## Issues Encountered
- `goods.g2b.go.kr:8053` 목록정보사이트 본체는 DWR(AJAX) 기반 JS 렌더링 페이지라 curl로 직접 조회 불가 — RESEARCH.md가 이미 예측한 제약과 동일. 대신 검색엔진(Naver, DuckDuckGo)에 색인된 나라장터 실제 물품 목록 페이지 타이틀을 통해 간접적으로 실코드를 확인하는 방법을 사용했다. DuckDuckGo HTML 엔드포인트는 몇 차례 요청 후 429/202로 스로틀되어, 이후 검색은 Naver 검색으로 전환해 계속했다.
- 시설관리(72/76 추정) 업종은 물품분류번호 대신 참가자격 업종코드(§세 가지 코드 체계 구분의 두 번째 행) 중심으로 다뤄지는 정황만 발견했고, 확정적인 물품분류번호나 별도 용역분류 체계의 존재 여부는 확인하지 못해 `[미확인]`으로 남기고 §미확인 항목과 확인 방법에 확인 경로를 남겼다.

## User Setup Required

None - no external service configuration required. (이 플랜은 goods.g2b.go.kr 검색엔진 색인 조회만 사용했으며, 로그인이나 API 키가 필요한 작업은 없었다.)

## Next Phase Readiness
- Phase 2 planner는 이 문서 한 장으로 "업체 프로필에 무엇을 저장하고 공고의 어느 필드와 조인하는가"를 파악할 수 있다
- 플랜 03(DB 스키마 설계)은 `company_classification_codes` 테이블 설계 시 이 문서의 "가변 길이 prefix" 권장안을 반드시 반영해야 한다 — 고정 8자리 컬럼 가정은 이 문서가 명시적으로 뒤집었다
- 남은 블로커: 시설관리 업종의 물품분류번호(또는 용역분류코드 존재 여부)는 Phase 2 착수 전 goods.g2b.go.kr 직접 로그인 조회로 재확인이 필요하다 — §미확인 항목과 확인 방법 1번 참고

---
*Phase: 01-prep*
*Completed: 2026-08-25*
