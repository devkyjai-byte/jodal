# Phase 1: 준비(Prep) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-25
**Phase:** 1-준비(Prep)
**Areas discussed:** 서비스명·도메인, DB 스키마 설계 범위, 업종코드 매핑 기준, 와이어프레임 산출물 형식

---

## 서비스명·도메인

| Option | Description | Selected |
|--------|-------------|----------|
| 조달메이트로 확정 | 지금까지 모든 문서(PROJECT.md, 로드맵, Artifact)에 이미 사용된 이름 | ✓ |
| 다른 후보명도 검토 | 더 나은 대안이 있는지 함께 생각 | |

**User's choice:** 조달메이트로 확정

| Option | Description | Selected |
|--------|-------------|----------|
| .co.kr | 국내 B2B/조달 업체 대상 서비스로 신뢰도가 중요한 도메인 관례에 부합 | ✓ |
| .com | 해외/확장성까지 염두 | |
| 지금은 미정, 개발 진행하며 결정 | 도메인 확보를 Phase 1 이후로 미룸 | |

**User's choice:** .co.kr (jodalmate.co.kr 확보 시도)

| Option | Description | Selected |
|--------|-------------|----------|
| 사용자가 직접 구매 | 결제수단이 필요해 Claude가 대신 수행 불가 | ✓ |
| 도메인은 나중에, 우선 서브도메인/개발서버로 진행 | MVP는 Vercel/Netlify 기본 도메인으로 먼저 띄움 | |

**User's choice:** 사용자가 직접 구매
**Notes:** 도메인 확보는 Phase 1 계획의 사용자 액션 체크리스트 항목으로 남김.

---

## DB 스키마 설계 범위

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 2(MVP) 핵심 테이블만 | 업체·공고·매칭·알림 등 MVP에 직접 필요한 테이블만 먼저 구체화 | ✓ |
| Phase 2~6 전체를 아우르는 스키마 | 처음부터 전체 테이블(자격판단·낙찰통계·서류초안 포함) 설계 | |

**User's choice:** Phase 2(MVP) 핵심 테이블만
**Notes:** 빠른 착수 우선. Phase 3~6에서 테이블 추가 시 스키마 재설계 비용이 발생할 수 있음을 인지하고 감수.

---

## 업종코드 매핑 기준

| Option | Description | Selected |
|--------|-------------|----------|
| 나라장터 물품분류번호(품목) 기준 | 공고 자체가 이 분류로 태깅되어 매칭 정확도가 가장 높음, API에서 바로 제공 | ✓ |
| 통계청 표준산업분류(KSIC) 기준 | 일반적인 업종 표현 방식이지만 품목분류와 직접 매칭 안 됨 | |
| 둘 다 저장(이중 매핑) | 정확도는 높지만 초기 구축 부담이 큼 | |

**User's choice:** 나라장터 물품분류번호(품목) 기준

| Option | Description | Selected |
|--------|-------------|----------|
| 목표 업종 3~5개로 시작 | REQUIREMENTS.md/ROADMAP.md의 Next Actions와 동일 범위 | ✓ |
| 주요 업종 전체(10개+)를 넘게 커버 | 초기부터 더 넓은 커버리지 확보, 매핑 작업량 증가 | |

**User's choice:** 목표 업종 3~5개로 시작

---

## 와이어프레임 산출물 형식

| Option | Description | Selected |
|--------|-------------|----------|
| 텍스트 명세 | 화면별 컴포넌트·레이아웃·상호작용을 마크다운으로 정리, 작성이 빠름 | ✓ |
| 시각적 HTML 스케치까지 제작 | 핵심 화면을 실제 목업으로 만들어 느낌을 먼저 확인 | |

**User's choice:** 텍스트 명세

| Option | Description | Selected |
|--------|-------------|----------|
| MVP 핵심 4화면 | 온보딩/업체 프로필, 공고 피드, 공고 상세, 알림 설정 — Phase 2 실행에 직접 필요한 화면만 | ✓ |
| 전체 로드맵 화면까지 포함 | 자격판단 배지, 낙찰통계 대시보드, AI 서류작성 화면까지 미리 구상 | |

**User's choice:** MVP 핵심 4화면

---

## Claude's Discretion

- DB 스키마의 정확한 컬럼명·타입·인덱스 설계
- 업종코드-물품분류번호 매핑 데이터의 구체적 소싱 방법
- 텍스트 와이어프레임 문서의 세부 형식

## Deferred Ideas

- KSIC(표준산업분류) 이중 매핑 — 필요해지면 이후 Phase에서 추가
- 자격판정·낙찰통계·AI서류작성 화면의 와이어프레임 — 각 기능이 시작되는 Phase(4, 5, 6)에서 다룸
