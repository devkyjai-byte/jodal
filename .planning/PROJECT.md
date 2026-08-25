# 조달메이트

## What This Is

조달청 나라장터 공고를 업체 프로필(업종코드·지역·실적·보유인증)과 자동으로 매칭해, "받고 싶은 조달"을 놓치지 않게 돕는 서비스. 1인 개발로 웹+모바일을 동시에 출시하는 것을 목표로 한다.

## Core Value

원하는 조달 공고를 놓치지 않는다 — 맞춤 매칭·알림 기능 하나만으로도 이 가치는 성립한다.

## Business Context

- **Customer**: 조달 입찰에 참여하는 중소기업/업체 담당자
- **Revenue model**: 구독제 (Phase 5, AI 입찰서류 작성 지원 도입 시점부터 유료 전환 검토)
- **Success metric**: 미정 — MVP 출시 후 가입 업체 수 및 매칭 알림 클릭률로 검증 예정
- **Strategy notes**: 원본 로드맵 문서 — `jodal` (프로젝트 루트, 이 문서의 소스)

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] 맞춤 공고 매칭·알림 — 업종코드·지역·실적·인증 기반 스코어링, 신규 공고 자동 알림 (MVP 핵심)
- [ ] 웹+모바일 동시 출시 — Next.js PWA를 Capacitor로 감싸 iOS/Android 스토어 등록
- [ ] 입찰 자격요건 자동 판별 — 참가자격 조항 파싱 후 참가가능/확인필요/불가 판정
- [ ] 낙찰가·경쟁 분석 — 예정가격 대비 낙찰률 분포, 유사 공고 경쟁 강도 통계
- [ ] 입찰서류 작성 지원 — 체크리스트 자동 생성 + AI 제안서/견적서 초안 (RAG)

### Out of Scope

- "입찰 대행" 서비스 — 법적 리스크. "정보 제공·보조 도구"로만 포지셔닝하며 낙찰 보장 등의 표현은 금지
- 4개 기능 동시 개발 — 1인 개발 + 3~4개월 MVP 기준으로 비현실적. 매칭·알림 하나로 MVP 범위를 한정하고 나머지는 순차 추가

## Context

- 1인 개발, 웹+모바일 동시 출시가 목표. 전체 기능(4개) 완성은 대략 7~8개월차 목표
- 시스템은 5개 레이어로 구성: (0) 외부 데이터 소스(공공데이터포털 API) → (1) 수집·정규화(배치/파서) → (2) 코어 엔진(매칭·자격판별·낙찰분석·AI서류작성) → (3) 플랫폼 서비스(인증·프로필·알림·결제·관리자) → (4) 클라이언트(Next.js PWA + Capacitor)
- 외부 데이터 소스: 공공데이터포털(data.go.kr)의 나라장터 입찰공고정보서비스, 사전규격정보서비스, 낙찰정보서비스, 계약정보서비스, 종합쇼핑몰(MAS) API
- 공공데이터포털 API 활용 신청이 선행 과제 — 승인까지 수일 소요될 수 있어 가장 먼저 신청해야 함
- 원본 로드맵 문서가 이 프로젝트 폴더의 `jodal` 파일에 텍스트로 보존되어 있음 (이전 대화에서 작성된 아키텍처/로드맵 초안)

## Constraints

- **Team**: 1인 개발 — 기능 범위와 일정은 항상 이 제약을 우선 반영
- **Tech stack**: Next.js+TypeScript(PWA) / Capacitor(모바일 래핑) / NestJS 또는 FastAPI(백엔드) / PostgreSQL / Meilisearch 또는 OpenSearch(검색) / Redis+BullMQ(큐·스케줄러) — 러닝커브·운영부담이 적은 조합 우선
- **Timeline**: MVP(매칭·알림) 3~4개월, 전체 4개 기능 완성 7~8개월
- **Legal**: 이용약관에 "정보 제공·보조 도구"임을 명시, 낙찰 보장 등의 표현 금지. 사업자등록번호 등 민감정보는 개인정보보호법·정보통신망법 준수 및 암호화 저장 필수
- **API 한도**: 공공데이터포털 API 일일 호출 한도 존재 — 캐싱 전략 또는 한도 상향 신청 필요
- **인프라**: 공공데이터 연동 특성상 국내 리전(Naver Cloud Platform 또는 AWS 서울 리전) 우선 고려

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| MVP 범위를 "맞춤 매칭·알림" 1개 기능으로 한정 | 1인 개발+3~4개월로 4개 기능 전부 완성은 비현실적, 미완성 상태로 지치는 것을 방지 | — Pending |
| 웹+모바일은 Next.js PWA를 Capacitor로 래핑하는 단일 코드베이스 전략 | 코드베이스 하나로 "동시 출시" 목표를 달성하면서 개발량은 늘리지 않음 | — Pending |
| 인프라는 국내 리전(NCP/AWS 서울) 우선 고려 | 공공데이터 연동 시 국내 리전이 유리 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-25 after initialization*
