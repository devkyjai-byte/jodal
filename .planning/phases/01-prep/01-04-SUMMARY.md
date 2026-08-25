---
phase: 01-prep
plan: 04
subsystem: design
tags: [wireframe, ux-spec, text-spec, ui-flow, markdown]

# Dependency graph
requires:
  - phase: 01-prep (plan 02)
    provides: "docs/design/업종-물품분류-매핑.md — 물품분류 대분류/중분류 다중 선택 프로필 저장 형식 권장안 (D-06)"
provides:
  - "docs/design/wireframes/00-user-journey.md — 가입→첫 알림→상세→알림 조정 단일 경로, 화면 간 데이터 인계 계약 표, 화면별 읽기·쓰기 테이블"
  - "docs/design/wireframes/01-onboarding.md — 5스텝 온보딩, 물품분류 계층 다중 선택 업종 컴포넌트 명세"
  - "docs/design/wireframes/02-feed.md — 키워드·업종·지역·마감일 4축 필터 피드 명세"
  - "docs/design/wireframes/03-detail.md — 나라장터 원문 링크 필수 배치 공고 상세 명세"
  - "docs/design/wireframes/04-notification-settings.md — notification_settings 컬럼 1:1 대응 알림 설정 명세"
affects: [02-mvp]

actuals:
  tokens: 8219
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "텍스트 와이어프레임 템플릿(목적/진입 경로/레이아웃/상호작용/데이터 소스/엣지 케이스)을 4화면 모두에 일관 적용"

key-files:
  created:
    - docs/design/wireframes/00-user-journey.md
    - docs/design/wireframes/01-onboarding.md
    - docs/design/wireframes/02-feed.md
    - docs/design/wireframes/03-detail.md
    - docs/design/wireframes/04-notification-settings.md
  modified: []

key-decisions:
  - "적합도는 백분율·점수 숫자가 아닌 5단계 정성 등급으로만 표시 — 낙찰 보장/확정적 예측 표현 금지(PROJECT.md Legal)와 직접 연결"
  - "공고 피드는 페이지네이션이 아닌 무한 스크롤 채택 — 탐색형 목록 특성 + 모바일(Capacitor) 환경 고려"
  - "알림 설정은 항목별 즉시 저장(저장 버튼 없음) — 토글/슬라이더 위주 설정 화면에서 저장 여부 불확실성 제거"
  - "방해금지 시간대에 발생한 알림은 버리지 않고 종료 시각 이후로 미룸 — 핵심 가치(공고를 놓치지 않는다)와 직접 충돌 방지"
  - "시설관리 업종 코드는 [미확인] 상태를 온보딩 화면 각주로 그대로 노출 — 확정되지 않은 값을 사용자에게 확정값처럼 보여주지 않음"

patterns-established:
  - "각 화면 문서 §데이터 소스가 00-user-journey.md §화면별 읽기·쓰기 테이블과 반드시 일치해야 한다는 교차 검증 규칙"

requirements-completed: [SC-3]

coverage:
  - id: D1
    description: "wireframes/ 디렉터리에 정확히 5개 .md 파일(여정 1 + 화면 4)이 존재하고, 각 파일이 필수 섹션(목적/진입 경로/레이아웃/상호작용/데이터 소스/엣지 케이스 또는 여정 전용 5섹션)과 필수 근거 키워드(D-06/D-09/D-10/CLIENT-05/ING-04/PROF-05/MATCH-02/MATCH-03/NOTF-01/ING-03 등)를 포함한다"
    requirement: "SC-3"
    verification:
      - kind: other
        ref: "grep-based structural checks per task <automated> verify block in 01-04-PLAN.md (Task 1/2/3), re-run manually via Grep tool — all PASS"
        status: pass
    human_judgment: false
  - id: D2
    description: "화면 명세의 서술 품질 — 낙찰 보장·확정적 예측·입찰 대행을 암시하는 UI 카피가 없는지, 00-user-journey.md의 데이터 인계 계약과 각 화면 §데이터 소스가 실제로 어긋나지 않는지에 대한 의미적 검토"
    requirement: "SC-3"
    verification: []
    human_judgment: true
    rationale: "카피 톤·문구가 법적 리스크(낙찰 보장 표현 금지)를 실제로 피하는지, 화면 간 인계 값이 문장 수준에서 정말 일관되는지는 정규식 grep으로 확정할 수 없는 판단이 필요하다."

duration: ~50min (interrupted by a usage-limit reset between Task 2 and Task 3; net active work time)
completed: 2026-08-26
status: complete
---

# Phase 1 Plan 04: MVP 4화면 텍스트 와이어프레임 명세 Summary

**MVP 핵심 4화면(온보딩·피드·상세·알림설정) + 여정 문서 1개, 총 5개 마크다운 텍스트 와이어프레임으로 SC-3의 나머지 절반을 닫음 — HTML/React 목업 없이 순수 명세**

## Performance

- **Duration:** ~50min 활성 작업 (세션 중간에 usage-limit reset으로 인한 중단 있었음, 재개 후 이어서 완료)
- **Started:** 2026-08-25T23:0x (Task 1 착수, KST)
- **Completed:** 2026-08-26T08:33:53+09:00 (Task 3 커밋)
- **Tasks:** 3/3
- **Files modified:** 5 (전부 신규 생성)

## Accomplishments

- `00-user-journey.md`: 정보통신 업종 소규모 업체 담당자 1명이 가입 → 첫 매칭 이메일 → 상세에서 원문 대조 → 알림 임계값 조정까지 도달하는 단일 경로를 4단계로 확정하고, 각 단계의 (화면/사용자 행동/시스템 반응/다음 단계로 넘기는 값) 4요소와 화면 간 데이터 인계 계약(URL 파라미터 vs 세션 값 구분), 화면별 읽기·쓰기 테이블을 표로 명세
- `01-onboarding.md`: 업종 선택을 자유 텍스트가 아닌 물품분류 대분류/중분류 계층 다중 선택 컴포넌트로 명세하고, 저장 값이 선택 깊이 그대로인 가변 길이 prefix임을 명시 — `업종-물품분류-매핑.md`의 권장안을 화면 컴포넌트로 실제로 인계(01-VERIFICATION.md가 `NOT_WIRED`로 표시했던 연결을 닫음)
- `02-feed.md`: 키워드·업종·지역·마감일 4축 필터(ING-04)와 카드별 매칭 근거 한 줄, 낙찰 보장으로 읽히지 않는 5단계 정성 적합도 표시를 명세
- `03-detail.md`: 나라장터 원문 링크를 스크롤 없이 닿는 위치의 필수 요소로 못박고, 타 업체 매칭 식별자 접근 거부(T-01-16)와 Phase 4/5 화면 경계(D-10)를 명세
- `04-notification-settings.md`: 채널·임계값·발송빈도·방해금지시간대·마감리마인더 각 항목을 `notification_settings` 컬럼과 1:1 대응표로 연결하고, 모든 채널 off 시도에 확인 게이트를 둠

## Task Commits

Each task was committed atomically:

1. **Task 1: 핵심 사용자 여정 (tracer)** - `1946140` (docs)
2. **Task 2: 온보딩·피드 화면 명세** - `101783f` (docs)
3. **Task 3: 상세·알림설정 화면 명세** - `5f62e23` (docs)

**Plan metadata:** *(SUMMARY.md commit — pending, this worktree does not touch STATE.md/ROADMAP.md/REQUIREMENTS.md; orchestrator merges and updates those centrally)*

_Note: gap_closure 플랜이며 코드가 아닌 마크다운 명세만 산출 — TDD 사이클 해당 없음._

## Files Created/Modified

- `docs/design/wireframes/00-user-journey.md` - 4단계 단일 사용자 여정, 데이터 인계 계약 표, 화면별 읽기·쓰기 테이블
- `docs/design/wireframes/01-onboarding.md` - 5스텝 온보딩/업체 프로필 등록 명세
- `docs/design/wireframes/02-feed.md` - 4축 필터 공고 피드 명세
- `docs/design/wireframes/03-detail.md` - 공고 상세(원문 링크 필수) 명세
- `docs/design/wireframes/04-notification-settings.md` - 알림 설정(테이블 컬럼 대응) 명세

## Decisions Made

- 적합도 표시는 숫자 점수/백분율이 아닌 5단계 정성 등급 — Legal 제약(낙찰 보장·확정적 예측 금지)을 화면 카피 레벨에서 선제 차단
- 피드 "더 보기"는 무한 스크롤 채택(페이지네이션 아님) — 탐색형 목록 + 모바일 환경 근거
- 알림 설정은 항목별 즉시 저장 — 저장 버튼 불확실성 제거
- 방해금지 시간대 알림은 버리지 않고 지연 발송 — 시간 민감 정보(마감 기한) 특성상 유실 방지가 핵심 가치와 직결
- 상세 화면의 "이 공고 저장" 액션은 저장 대상 테이블을 이 문서에서 확정하지 않음(00-user-journey.md 표에도 "없음"으로 명시) — Phase 2에서 결정하도록 명시적으로 위임, 화면과 스키마 문서가 서로 다른 값을 임의로 가정하지 않도록 함

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 precondition file missing due to stale worktree base — fast-forward merge from master**
- **Found during:** Task 1 precondition check (`docs/design/업종-물품분류-매핑.md` 존재 확인)
- **Issue:** 이 워크트리 브랜치(`worktree-agent-a219bc3276e06dde0`)가 wave 1(01-01, 01-02) 산출물이 master에 병합되기 이전 커밋(`6f1cb9d`)에서 분기되어, 플랜이 요구하는 선행 산출물(`업종-물품분류-매핑.md`)이 이 워크트리에 존재하지 않았다. `depends_on: []`이라 플랜 순서 메타데이터로는 이 의존성이 드러나지 않는다는 점을 이 플랜 자신이 이미 정확히 지적하고 있었다(플랜 objective 참고).
- **Fix:** `git merge master --ff-only` 실행 — 이 워크트리 브랜치에 고유 커밋이 전혀 없어(`merge-base(HEAD, master) == HEAD`) 손실 위험 없는 순수 fast-forward였다. 병합 후 `docs/design/업종-물품분류-매핑.md`, `01-01/02-PLAN.md`, `01-01/02-SUMMARY.md` 등 wave 1 산출물이 워크트리에 나타났다.
- **Files modified:** 없음(코드 변경 아님, 브랜치 동기화)
- **Verification:** 병합 후 `docs/design/업종-물품분류-매핑.md` 존재 확인, 이후 Task 1의 `<automated>` 검증 전체 PASS
- **Committed in:** 병합 자체는 커밋이 아니라 fast-forward이므로 새 해시 없음 — `1946140`(Task 1 커밋)이 병합된 베이스 위에서 만들어짐

**2. [Rule 1 - Bug] Task 3 verify gate — MATCH-02 인용 누락**
- **Found during:** Task 3 자동 검증 재실행 (커밋 전)
- **Issue:** `04-notification-settings.md` 초안에 `MATCH-03`만 인용되고 플랜의 `<automated>` 게이트가 요구하는 `MATCH-02` 인용이 빠져 있었다.
- **Fix:** §데이터 소스 도입부에 "이 화면의 모든 설정 항목은 매칭 알림 발송 조건(`MATCH-02`)과 발송 채널·빈도(`MATCH-03`)를 사용자가 직접 제어하는 통로"라는 문장을 추가해 두 요구사항 ID를 모두 근거로 연결
- **Files modified:** `docs/design/wireframes/04-notification-settings.md`
- **Verification:** 재검증 grep에서 `MATCH-02`, `MATCH-03` 모두 확인
- **Committed in:** `5f62e23` (Task 3 커밋에 포함, 별도 커밋 아님 — 커밋 전 발견되어 수정됨)

---

**Total deviations:** 2 auto-fixed (1 blocking 워크트리 동기화, 1 검증 게이트 인용 누락)
**Impact on plan:** 둘 다 산출물 내용 자체의 스코프를 넘지 않는 수정 — 워크트리 동기화는 손실 없는 fast-forward, MATCH-02 인용 추가는 이미 서술된 내용에 요구사항 근거 한 문장을 더한 것.

## Issues Encountered

- 세션 중간에 usage-limit reset으로 인한 중단이 있었다(Task 2 커밋 이후, Task 3 착수 전). 재개 시 `git log`로 Task 1/2 커밋(`1946140`, `101783f`)이 이미 존재함을 확인하고, `03-detail.md`/`04-notification-settings.md`가 이미 완전한 상태로 디스크에 있음을 다시 읽어 재검증한 뒤(초안이 아니라 완성본이었음을 확인) Task 3을 이어서 진행했다. 재작업이나 내용 손실은 없었다.

## User Setup Required

None - 이 플랜은 외부 서비스 설정이 필요 없다(마크다운 문서만 산출).

## Next Phase Readiness

- SC-3(핵심 DB 스키마·와이어프레임 확정)의 와이어프레임 절반이 닫혔다. DB 스키마 절반(`db-schema-design.md`)은 플랜 03이 별도로 담당 — 이 플랜 실행 시점에는 아직 완료되지 않아, 각 화면 문서의 §데이터 소스는 `01-RESEARCH.md`의 표준 테이블 이름(`companies`, `company_classification_codes`, `company_performances`, `company_certifications`, `bid_announcements`, `matches`, `notification_logs`, `notification_settings`)을 임시 기준으로 인용했다. **플랜 03 완료 후, 실제 컬럼명이 이 문서들의 표와 다르면 각 화면 문서의 §데이터 소스에 각주로 정정이 필요할 수 있다** — Phase 2 planner는 두 문서(이 플랜의 와이어프레임 + 플랜 03의 스키마)를 함께 대조해야 한다.
- Phase 2 planner는 `01-onboarding.md`의 업종 선택 컴포넌트 명세를 그대로 컴포넌트 단위 태스크로 변환할 수 있다 — 자유 텍스트 입력이 아니라 계층 다중 선택이라는 제약이 문서에 못박혀 있다.
- 시설관리 업종의 물품분류 코드가 여전히 `[미확인]`이다(`업종-물품분류-매핑.md` 상속) — Phase 2 착수 전 `goods.g2b.go.kr` 직접 조회로 확정이 필요하며, 이 플랜은 그 불확실성을 감추지 않고 온보딩 화면 각주로 그대로 노출했다.
- 상세 화면의 "공고 저장/관심 표시" 액션이 쓰는 테이블은 이 플랜의 범위에서 의도적으로 미확정 — Phase 2가 결정해야 할 항목으로 남겨두었다(플랜 03 스키마에 해당 테이블이 없으면 Phase 2에서 새로 설계 필요).

---
*Phase: 01-prep*
*Completed: 2026-08-26*
