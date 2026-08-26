# Roadmap: 조달메이트

## Overview

나라장터 공고를 업체 프로필과 자동 매칭해주는 서비스를 1인 개발로 웹+모바일 동시 출시한다. Phase 1에서 API 신청과 설계를 마치고, Phase 2에서 "맞춤 매칭·알림"만으로 MVP를 완성해 핵심 가치를 검증한다. Phase 3에서 같은 코드베이스를 Capacitor로 감싸 모바일 스토어에 출시하고, 이후 Phase 4~6에서 자격요건 판별·낙찰가 분석·AI 서류작성 지원을 순차적으로 붙여 전체 4대 기능을 완성한다.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: 준비 (Prep)** - API 활용 신청, 스키마·와이어프레임·서비스명 확정
- [ ] **Phase 2: MVP — 맞춤 매칭·알림** - 공고 수집·정규화 + 업체 프로필 + 매칭 알림 + 검색 웹 UI
- [ ] **Phase 3: 모바일 스토어 출시 (Mobile Launch)** - Capacitor 네이티브 푸시 + 스토어 심사 대응 + 온보딩
- [ ] **Phase 4: 입찰 자격요건 자동 판별 (Eligibility)** - 참가자격 파싱 + 프로필 대조 + 3단계 판정
- [ ] **Phase 5: 낙찰가·경쟁 분석 (Bid Analysis)** - 낙찰 데이터 누적 + 낙찰률 분포·경쟁 강도 통계
- [ ] **Phase 6: AI 입찰서류 작성 지원 (Doc Assist)** - 서류 체크리스트 + RAG 기반 제안서·견적서 초안

## Phase Details

### Phase 1: 준비 (Prep)

**Goal**: 개발을 시작하기 위한 전제조건(외부 API 접근, 데이터 모델, 화면 구조, 서비스 정체성)을 모두 확정한다
**Depends on**: Nothing (first phase)
**Requirements**: (설정 단계 — 기능 요구사항 없음, Phase 2 이후 요구사항의 전제조건)
**Success Criteria** (what must be TRUE):

  1. 공공데이터포털에 나라장터 입찰공고정보·사전규격정보·낙찰정보·계약정보서비스 API 활용 신청이 완료되어 있다
  2. 업종코드(업태·품목) ↔ 조달 분류체계 매핑 설계 문서가 존재한다
  3. 핵심 DB 스키마와 화면 와이어프레임이 확정되어 있다
  4. 서비스명과 도메인이 확정되어 있다

**Plans**: 4 plans

Plans:

- [x] 01-01-PLAN.md — 나라장터 API 4종 활용신청 체크리스트 + 서비스명·도메인 확정 (SC-1, SC-4)
- [x] 01-02-PLAN.md — 업종 ↔ 물품분류번호 매핑 설계 문서 (SC-2)
- [x] 01-03-PLAN.md — 핵심 DB 스키마 설계 문서 (SC-3, gap closure)
- [x] 01-04-PLAN.md — MVP 4화면 텍스트 와이어프레임 명세 (SC-3, gap closure)

### Phase 2: MVP — 맞춤 매칭·알림

**Goal**: "받고 싶은 조달을 놓치지 않는다"는 핵심 가치를 매칭·알림 기능 하나로 완결시킨다
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, ING-01, ING-02, ING-03, ING-04, MATCH-01, MATCH-02, MATCH-03, CLIENT-01
**Success Criteria** (what must be TRUE):

  1. 사용자는 업종·지역·실적·인증 정보를 등록해 업체 프로필을 완성할 수 있다
  2. 시스템은 나라장터 신규 공고를 배치로 자동 수집해 중복·개정을 병합한 정규화된 형태로 저장한다
  3. 사용자는 자신의 프로필과 적합도 높은 신규 공고를 이메일 또는 푸시 알림으로 받는다
  4. 사용자는 웹(Next.js PWA)에서 공고를 키워드·업종·지역·마감일로 검색·필터링해 볼 수 있다

**Plans**: TBD

Plans:

- [ ] 02-01: TBD (`/gsd-plan-phase 2`에서 세부 계획 생성)

### Phase 3: 모바일 스토어 출시 (Mobile Launch)

**Goal**: Phase 2의 웹 코드베이스를 그대로 iOS/Android 스토어에 출시해 "웹+모바일 동시 출시"를 완성한다
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: CLIENT-02, CLIENT-03, CLIENT-04, CLIENT-05
**Success Criteria** (what must be TRUE):

  1. 사용자는 iOS App Store에서 앱을 설치해 이용할 수 있다
  2. 사용자는 Google Play에서 앱을 설치해 이용할 수 있다
  3. 사용자는 모바일 앱에서 네이티브 푸시 알림(FCM/APNs)을 받는다
  4. 신규 사용자는 온보딩 과정을 거쳐 첫 매칭 알림까지 자연스럽게 도달한다

**Plans**: TBD

Plans:

- [ ] 03-01: TBD (`/gsd-plan-phase 3`에서 세부 계획 생성)

### Phase 4: 입찰 자격요건 자동 판별 (Eligibility)

**Goal**: 공고 참가자격을 업체 프로필과 자동 대조해 참가 가능 여부를 즉시 판정한다
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: ELIG-01, ELIG-02, ELIG-03
**Success Criteria** (what must be TRUE):

  1. 시스템은 공고문의 참가자격 조항을 구조화해 파싱한다
  2. 시스템은 업체 프로필과 참가자격을 대조해 참가가능/확인필요/참가불가 중 하나로 판정한다
  3. 사용자는 매칭 알림과 공고 상세 화면에서 자격 판정 결과를 함께 확인할 수 있다

**Plans**: TBD

Plans:

- [ ] 04-01: TBD (`/gsd-plan-phase 4`에서 세부 계획 생성)

### Phase 5: 낙찰가·경쟁 분석 (Bid Analysis)

**Goal**: 과거 낙찰 데이터를 축적해 예정가격 대비 낙찰률과 경쟁 강도를 통계로 보여준다
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: BID-01, BID-02, BID-03
**Success Criteria** (what must be TRUE):

  1. 시스템은 낙찰정보서비스 API로 과거 낙찰 데이터를 지속적으로 누적한다
  2. 사용자는 공고 상세에서 예정가격 대비 낙찰률 분포를 확인할 수 있다
  3. 사용자는 유사 공고의 경쟁 강도 통계를 확인할 수 있다

**Plans**: TBD

Plans:

- [ ] 05-01: TBD (`/gsd-plan-phase 5`에서 세부 계획 생성)

### Phase 6: AI 입찰서류 작성 지원 (Doc Assist)

**Goal**: 공고별 필요서류를 체크리스트로 안내하고, 회사 정보를 반영한 제안서·견적서 초안을 AI로 생성한다
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):

  1. 사용자는 공고별 필요서류 체크리스트를 자동으로 받는다
  2. 사용자는 회사 정보와 공고 요건을 반영한 제안서 초안을 AI로 생성할 수 있다
  3. 사용자는 회사 정보와 공고 요건을 반영한 견적서 초안을 AI로 생성할 수 있다

**Plans**: TBD

Plans:

- [ ] 06-01: TBD (`/gsd-plan-phase 6`에서 세부 계획 생성)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 준비 (Prep) | 4/4 | Complete (human actions pending: API 신청·도메인 구매) | 2026-08-26 |
| 2. MVP — 맞춤 매칭·알림 | 0/TBD | Not started | - |
| 3. 모바일 스토어 출시 (Mobile Launch) | 0/TBD | Not started | - |
| 4. 입찰 자격요건 자동 판별 (Eligibility) | 0/TBD | Not started | - |
| 5. 낙찰가·경쟁 분석 (Bid Analysis) | 0/TBD | Not started | - |
| 6. AI 입찰서류 작성 지원 (Doc Assist) | 0/TBD | Not started | - |
