# Phase 1: 준비 (Prep) - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1은 코드를 작성하지 않는 준비 단계다. 개발을 시작하기 위한 전제조건 — 외부 API 접근권, 핵심 DB 스키마, MVP 화면 구조, 서비스 정체성(이름·도메인) — 을 모두 확정하는 것이 목표다. 여기서 만든 산출물은 Phase 2(MVP) 계획과 구현의 입력이 된다.

</domain>

<decisions>
## Implementation Decisions

### 서비스명·도메인
- **D-01:** 서비스명은 "조달메이트"로 확정한다. 이미 PROJECT.md, ROADMAP.md, GitHub 저장소 설명, Artifact 문서 전반에 사용된 이름을 그대로 유지한다.
- **D-02:** 도메인은 `.co.kr` 형식을 우선한다(예: jodalmate.co.kr) — 국내 B2B/조달 업체 대상 서비스는 `.co.kr`이 신뢰도 면에서 유리하다는 판단.
- **D-03:** 도메인 구매는 사용자가 직접 진행한다 — 결제수단이 필요해 Claude가 대신 수행할 수 없는 사용자 액션 항목. Phase 1 계획에는 "도메인 확보"를 사용자 체크리스트 항목으로 남긴다.

### DB 스키마 설계 범위
- **D-04:** Phase 1에서는 Phase 2(MVP)에 직접 필요한 핵심 테이블만 구체화한다 — 업체 프로필(업종·지역·실적·인증), 공고(정규화된 레코드), 매칭 결과, 알림 발송 이력 등. **Reversibility:** costly — Phase 3~6에서 새 테이블(자격판정 결과, 낙찰통계, 서류초안)이 추가될 때 기존 스키마와의 관계(FK, 인덱스)를 다시 설계해야 할 수 있음. 빠른 MVP 착수를 위해 감수하기로 함.
- **D-05:** 자격판정·낙찰통계·AI서류작성 관련 테이블은 Phase 1에서 설계하지 않는다 — 해당 Phase(4~6)에서 착수 시점에 설계한다.

### 업종코드 매핑 기준
- **D-06:** 업종코드 매핑은 나라장터 물품분류번호(품목분류) 체계를 1차 기준으로 삼는다 — 공고 자체가 이 분류로 태깅되어 있어 매칭 정확도가 가장 높고, 공공데이터포털 API에서 바로 제공됨.
- **D-07:** 통계청 표준산업분류(KSIC)는 이번 Phase에서 별도 매핑 테이블로 만들지 않는다 — 필요해지면 이중 매핑을 나중에 추가한다.
- **D-08:** 매핑은 목표 업종 3~5개로 시작한다 — REQUIREMENTS.md/ROADMAP.md의 "이번 주 Next Actions"에 이미 명시된 범위와 동일. 초기 사용자 확보에 집중하고 이후 확장한다.

### 와이어프레임 산출물
- **D-09:** 와이어프레임은 실제 시각 목업이 아니라 화면별 컴포넌트·레이아웃·상호작용을 정리한 텍스트 명세로 남긴다 — Phase 2 planner가 바로 참조할 수 있고 작성 속도가 빠르다.
- **D-10:** Phase 1 와이어프레임은 MVP 핵심 4화면만 다룬다 — ① 온보딩/업체 프로필 등록, ② 공고 피드(매칭된 공고 목록), ③ 공고 상세, ④ 알림 설정. 자격판정 배지, 낙찰통계 대시보드, AI 서류작성 화면 등 Phase 3 이후 화면은 이번에 다루지 않는다.

### Claude's Discretion
- DB 스키마의 정확한 컬럼명·타입·인덱스 설계는 Phase 1 실행(plan-phase → execute-phase) 중 Claude가 표준 관례를 따라 결정한다.
- 업종코드-물품분류번호 매핑 데이터의 구체적 소싱 방법(공공데이터포털 API 직접 조회 vs 수동 CSV)은 실행 시점에 API 문서를 확인한 뒤 판단한다.
- 텍스트 와이어프레임의 정확한 문서 형식(마크다운 표 vs 섹션별 목록)은 Claude가 읽기 좋은 형태로 자유롭게 구성한다.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 프로젝트 컨텍스트
- `.planning/PROJECT.md` — 핵심 가치, 제약조건, 이전 결정 사항
- `.planning/REQUIREMENTS.md` — Phase 1은 기능 요구사항 없음(설정 단계); PROF/ING/MATCH/CLIENT 요구사항(Phase 2)의 전제조건 역할
- `.planning/ROADMAP.md` §Phase 1 — 이 Phase의 목표와 4개 Success Criteria

### 원본 기획 문서
- `../../../jodal` (프로젝트 루트) — 최초 아키텍처·로드맵 초안. 5-레이어 아키텍처, 추천 기술 스택(Next.js+PWA / Capacitor / NestJS·FastAPI / PostgreSQL / Meilisearch·OpenSearch / Redis+BullMQ), 리스크 목록의 출처

### 외부 API (Phase 1에서 신청 대상)
- 공공데이터포털(data.go.kr) — 조달청_나라장터 입찰공고정보서비스
- 공공데이터포털(data.go.kr) — 조달청_나라장터 사전규격정보서비스
- 공공데이터포털(data.go.kr) — 조달청_나라장터 낙찰정보서비스
- 공공데이터포털(data.go.kr) — 조달청_나라장터 계약정보서비스

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

그린필드 프로젝트 — 아직 작성된 코드가 없다 (has_existing_code: false). 재사용할 컴포넌트·패턴·통합 지점이 없다. Phase 1의 산출물(스키마 설계, 와이어프레임 명세)이 Phase 2 이후 코드베이스의 최초 기준점이 된다.

</code_context>

<specifics>
## Specific Ideas

- 서비스명 "조달메이트"는 변경 없이 그대로 유지 — 도메인 `jodalmate.co.kr` 확보 시도가 첫 액션.
- MVP 4화면(온보딩/업체 프로필, 공고 피드, 공고 상세, 알림 설정) 이외의 화면은 이번 Phase에서 그리지 않는다.

</specifics>

<deferred>
## Deferred Ideas

- KSIC(표준산업분류) 이중 매핑 — Phase 1에서는 나라장터 물품분류번호만 사용. 필요해지면 이후 Phase에서 추가.
- 자격판정·낙찰통계·AI서류작성 화면의 와이어프레임 — 각 기능이 시작되는 Phase(4, 5, 6)에서 다룬다.

### Reviewed Todos (not folded)
None — discussion stayed within phase scope (no pending todos existed for this phase).

</deferred>

---

*Phase: 1-준비(Prep)*
*Context gathered: 2026-08-25*
