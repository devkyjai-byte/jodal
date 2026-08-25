---
phase: 01-prep
plan: 01
subsystem: docs
tags: [data.go.kr, narajangteo-api, domain, service-name, checklist]

# Dependency graph
requires: []
provides:
  - "나라장터 Open API 4종(입찰공고정보·사전규격정보·낙찰정보·계약정보) 활용신청 절차·상태 추적표"
  - "서비스키(NARAJANGTEO_SERVICE_KEY) 보관 규칙 — .env·gitignore·서버사이드 전용"
  - "서비스명(조달메이트/Jodalmate) 확정 기록 및 도메인(jodalmate.co.kr 1순위 + 3개 대체 후보) 방침"
  - "도메인 확보를 위한 사용자 직접 수행 체크리스트(로그인/결제 필요 항목)"
affects: [01-prep 나머지 플랜(02~04), Phase 2 Ingestion 배치 환경변수, Phase 2/3 배포 인프라 및 PWA manifest]

actuals:
  tokens: 2270
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns: ["설계·운영 참고 문서 상단에 '실행 코드가 아니다' 고지 문구", "사용자 직접 수행 항목을 체크박스 목록으로 분리해 Claude 대행 범위와 경계를 명시"]

key-files:
  created:
    - docs/design/api-신청-체크리스트.md
    - docs/design/도메인-서비스명-체크리스트.md
  modified: []

key-decisions:
  - "활용목적 예시 문구는 '정보 제공·보조 도구' 포지셔닝을 유지하고 '낙찰 보장'/'입찰 대행' 표현을 배제해 PROJECT.md 법적 제약을 문서 단계에서부터 반영했다"
  - "서비스키는 .env의 NARAJANGTEO_SERVICE_KEY로만 보관하고 어떤 문서에도 실제 값을 남기지 않는 규칙을 명문화했다(git 유출 방지)"
  - "도메인 대체 후보 3개(jodalmate.kr, jodal-mate.co.kr, jodalmate.com)를 D-02 우선순위 논리와 함께 제시해 1순위 실패 시 즉시 대체 가능하게 했다"

patterns-established:
  - "Phase 1 설계 문서 공통 포맷: 상단 고지 → 배경/근거 → 실행 가능한 체크리스트/표 → 사용자 기입란 → 미해결 항목/파급 지점"

requirements-completed: [SC-1, SC-4]

coverage:
  - id: D1
    description: "나라장터 Open API 4종 활용신청 절차·추적표(api-신청-체크리스트.md)가 존재하고 4개 데이터셋 ID·6개 섹션·서비스키 보관 규칙을 모두 포함한다"
    requirement: "SC-1"
    verification:
      - kind: other
        ref: "Task 1 <automated> verify gate (grep 기반 섹션/데이터셋ID/신청전 카운트 검사) — PASS"
        status: pass
    human_judgment: true
    rationale: "문서 존재·섹션 완결성은 자동 검증했으나, 사용자가 실제로 data.go.kr에 로그인해 4건을 제출하고 승인 상태를 기록하는 것은 이 플랜의 범위 밖(end-of-phase human verify)이라 완료 여부를 사람이 최종 확인해야 한다"
  - id: D2
    description: "서비스명·도메인 확정 체크리스트(도메인-서비스명-체크리스트.md)가 존재하고 D-01/D-02/D-03 근거, 대체 후보 3개, 사용자 체크박스 4개 이상을 포함한다"
    requirement: "SC-4"
    verification:
      - kind: other
        ref: "Task 2 <automated> verify gate (grep 기반 섹션/키워드/체크박스 카운트 검사) — PASS"
        status: pass
    human_judgment: true
    rationale: "서비스명 확정 기록 자체는 자동 검증으로 충분하나, 도메인 실제 등록(결제)은 사용자 액션이므로 도메인 확보 완료 여부는 사람이 end-of-phase 시점에 확인해야 한다"

duration: 15min
completed: 2026-08-25
status: complete
---

# Phase 1 Plan 1: 나라장터 API 신청 · 서비스명/도메인 체크리스트 Summary

**나라장터 Open API 4종 활용신청 절차·추적표와 서비스명(조달메이트)/도메인(jodalmate.co.kr) 확정 체크리스트 문서 2건 작성 — 애플리케이션 코드 없이 순수 설계·운영 문서만 산출**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-25 (세션 시작)
- **Completed:** 2026-08-25T13:39:28Z
- **Tasks:** 2
- **Files modified:** 2 (신규 생성)

## Accomplishments
- `docs/design/api-신청-체크리스트.md` — 나라장터 Open API 4종(15129394/15129437/15129397/15129427) 신청 대상표, 5단계 신청 절차(활용목적 예시 문구 포함), 신청 상태 추적표(4행, 상태 초기값 `신청전`), 서비스키 보관 규칙(`.env`의 `NARAJANGTEO_SERVICE_KEY`, `.gitignore`, 서버사이드 전용), RESEARCH.md Open Question 2·4 이관 작성
- `docs/design/도메인-서비스명-체크리스트.md` — 서비스명 `조달메이트`/`Jodalmate` 확정 기록(D-01), 도메인 방침(D-02: `jodalmate.co.kr` 1순위 + 대체 후보 3개), 사용자 직접 수행 체크박스 4개(D-03), 확정 결과 기입란, 확정 후 파급 지점(Phase 2/3 환경변수·PWA manifest·SPF/DKIM·약관 URL)
- 두 문서 모두 실제 인증키·결제정보 등 민감값을 포함하지 않았음을 자동 검증(40자 이상 연속 토큰 부재 확인)

## Task Commits

Each task was committed atomically:

1. **Task 1: 나라장터 Open API 4종 활용신청 체크리스트 작성** - `b47b7f0` (docs)
2. **Task 2: 서비스명·도메인 확정 체크리스트 작성** - `e225475` (docs)

**Plan metadata:** (worktree 실행 — SUMMARY.md 단일 커밋으로 처리, STATE.md/ROADMAP.md/REQUIREMENTS.md는 오케스트레이터가 병합 후 중앙에서 갱신)

## Files Created/Modified
- `docs/design/api-신청-체크리스트.md` - 나라장터 Open API 4종 활용신청 절차·추적표·서비스키 보관 규칙
- `docs/design/도메인-서비스명-체크리스트.md` - 서비스명/도메인 확정 기록 및 사용자 체크리스트

## Decisions Made
- 활용목적 예시 문구는 "정보 제공·보조 도구" 포지셔닝을 유지하고 금지 표현("낙찰 보장", "입찰 대행")을 배제 — PROJECT.md Legal 제약 준수
- 서비스키는 어떤 문서에도 실제 값을 남기지 않고 `<REDACTED>` 자리표시자만 사용 — Threat T-01-01/T-01-02 대응
- 대체 도메인 후보 3개를 D-02 우선순위 논리(국내 B2B 신뢰도)와 함께 제시해 1순위 실패 시 즉시 대체 가능하게 함

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

worktree-isolated Bash 툴이 복합 명령(파이프·for 루프 등)을 실행 경로 검증 실패로 거부해, 계획의 `<automated>` verify 게이트 셸 스크립트를 그대로 실행하지 못했다. 동일한 검사 항목(데이터셋 ID 4개, 섹션 6/5개, 서비스키 규칙, `신청전`/체크박스 카운트, 금지 표현 부재)을 Grep 툴의 개별 호출로 분해해 전부 확인했으며, 결과는 계획의 automated gate와 동일한 PASS 판정이다.

## User Setup Required

None - no external service configuration required by Claude. 다만 이 플랜의 산출물은 사용자가 직접 수행해야 하는 후속 액션(data.go.kr 활용신청 4건 제출, 가비아/후이즈 도메인 결제)을 안내하는 문서다 — 두 문서의 "신청 상태 추적표"와 "사용자 직접 수행 항목"/"확정 결과" 섹션에 안내되어 있으며, end-of-phase human verify 시점에 사용자가 직접 수행한다.

## Next Phase Readiness
- api-신청-체크리스트.md와 도메인-서비스명-체크리스트.md 모두 SC-1/SC-4 요구 산출물을 충족한다
- 사용자가 즉시 data.go.kr에서 4건 활용신청을 제출하고, 가비아/후이즈에서 도메인 확보를 시도할 수 있는 상태
- 서비스키 보관 규칙이 Phase 2 Ingestion 배치 환경변수 설정(ING-01)의 전제 규칙으로 이미 문서화되어 있어 후속 플랜이 참조 가능
- 블로커 없음 — 남은 사용자 액션(API 승인 대기, 도메인 결제)은 본 플랜의 범위 밖(end-of-phase human verify)

---
*Phase: 01-prep*
*Completed: 2026-08-25*

## Self-Check: PASSED

- FOUND: docs/design/api-신청-체크리스트.md
- FOUND: docs/design/도메인-서비스명-체크리스트.md
- FOUND commit: b47b7f0
- FOUND commit: e225475
