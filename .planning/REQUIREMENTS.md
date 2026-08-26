# Requirements: 조달메이트

**Defined:** 2026-08-25
**Core Value:** 원하는 조달 공고를 놓치지 않는다

## v1 Requirements

기존 로드맵 문서(`jodal`)에 이미 확정된 6단계 로드맵(Phase 0~5)을 그대로 이번 마일스톤의 커밋 범위로 채택한다. Phase 1(매칭·알림)이 MVP이며, 이후 단계는 순차적으로 같은 v1 범위에 추가된다.

### 업체 프로필 (Profile)

- [ ] **PROF-01**: 업체는 업종코드(업태·품목)를 등록할 수 있다
- [ ] **PROF-02**: 업체는 활동 지역을 등록할 수 있다
- [ ] **PROF-03**: 업체는 과거 실적을 등록할 수 있다
- [ ] **PROF-04**: 업체는 보유 인증을 등록할 수 있다
- [x] **PROF-05**: 업체는 사업자등록번호로 가입·인증할 수 있다

### 공고 수집·검색 (Ingestion)

- [ ] **ING-01**: 시스템은 나라장터 입찰공고를 배치로 자동 수집한다 (일 4~6회 폴링)
- [ ] **ING-02**: 시스템은 수집한 공고문에서 품목·지역·참가자격 조건을 파싱해 정규화한다
- [ ] **ING-03**: 시스템은 중복 공고와 개정 공고를 하나로 병합한다
- [ ] **ING-04**: 사용자는 공고를 키워드·업종·지역·마감일로 검색·필터링할 수 있다

### 맞춤 매칭·알림 (Match) — MVP 핵심

- [ ] **MATCH-01**: 시스템은 업체 프로필과 신규 공고를 자동으로 스코어링해 매칭한다
- [ ] **MATCH-02**: 사용자는 적합도 높은 신규 공고를 이메일로 알림받는다
- [ ] **MATCH-03**: 사용자는 적합도 높은 신규 공고를 푸시 알림으로 받는다

### 웹·모바일 클라이언트 (Client)

- [ ] **CLIENT-01**: 사용자는 웹 브라우저에서 반응형 UI(Next.js PWA)로 서비스를 이용할 수 있다
- [ ] **CLIENT-02**: 사용자는 iOS App Store에서 앱을 설치해 이용할 수 있다 (Capacitor 래핑)
- [ ] **CLIENT-03**: 사용자는 Google Play에서 앱을 설치해 이용할 수 있다 (Capacitor 래핑)
- [ ] **CLIENT-04**: 사용자는 모바일 앱에서 네이티브 푸시 알림(FCM/APNs)을 받는다
- [ ] **CLIENT-05**: 신규 사용자는 온보딩을 거쳐 첫 매칭 알림까지 자연스럽게 도달한다

### 입찰 자격요건 자동 판별 (Eligibility)

- [ ] **ELIG-01**: 시스템은 공고문의 참가자격 조항을 구조화해 파싱한다
- [ ] **ELIG-02**: 시스템은 업체 프로필과 참가자격을 대조해 참가가능/확인필요/참가불가로 판정한다
- [ ] **ELIG-03**: 사용자는 매칭 알림·공고 상세에서 자격 판정 결과를 함께 확인할 수 있다

### 낙찰가·경쟁 분석 (Bid Analysis)

- [ ] **BID-01**: 시스템은 낙찰정보서비스 API로 과거 낙찰 데이터를 누적한다
- [ ] **BID-02**: 사용자는 공고 상세에서 예정가격 대비 낙찰률 분포를 확인할 수 있다
- [ ] **BID-03**: 사용자는 유사 공고의 경쟁 강도 통계를 확인할 수 있다

### 입찰서류 작성 지원 (Doc Assist)

- [ ] **DOC-01**: 사용자는 공고별 필요서류 체크리스트를 자동으로 받는다
- [ ] **DOC-02**: 사용자는 회사 정보와 공고 요건을 반영한 제안서 초안을 AI로 생성할 수 있다
- [ ] **DOC-03**: 사용자는 회사 정보와 공고 요건을 반영한 견적서 초안을 AI로 생성할 수 있다

## v2 Requirements

Phase 5 시점 이후 "검토 가능"으로만 언급된, 아직 커밋되지 않은 범위.

### 구독·결제 (Billing)

- **BILL-01**: 사용자는 유료 구독을 결제할 수 있다
- **BILL-02**: 관리자는 구독 상태와 결제 이력을 관리 콘솔에서 확인할 수 있다

### 카카오 알림톡

- **NOTF-01**: 사용자는 카카오 알림톡으로 매칭 알림을 받는다 (사업자 인증 절차 필요, 후순위)

## Out of Scope

| Feature | Reason |
|---------|--------|
| 입찰 대행(사용자 대신 입찰 진행/제출) | 법적 리스크 — "정보 제공·보조 도구"로만 포지셔닝, 낙찰 보장 표현 금지 |
| 4개 핵심 기능 동시 개발 | 1인 개발 + 3~4개월 MVP 제약상 비현실적. 매칭·알림(Phase 1)으로 한정 후 순차 추가 |
| 낙찰 보장·확정적 예측 표현 | 법적 리스크, 이용약관과 UI 문구 전반에서 금지 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROF-01 | Phase 1 | Pending |
| PROF-02 | Phase 1 | Pending |
| PROF-03 | Phase 1 | Pending |
| PROF-04 | Phase 1 | Pending |
| PROF-05 | Phase 1 | Complete |
| ING-01 | Phase 1 | Pending |
| ING-02 | Phase 1 | Pending |
| ING-03 | Phase 1 | Pending |
| ING-04 | Phase 1 | Pending |
| MATCH-01 | Phase 1 | Pending |
| MATCH-02 | Phase 1 | Pending |
| MATCH-03 | Phase 1 | Pending |
| CLIENT-01 | Phase 1 | Pending |
| CLIENT-02 | Phase 2 | Pending |
| CLIENT-03 | Phase 2 | Pending |
| CLIENT-04 | Phase 2 | Pending |
| CLIENT-05 | Phase 2 | Pending |
| ELIG-01 | Phase 3 | Pending |
| ELIG-02 | Phase 3 | Pending |
| ELIG-03 | Phase 3 | Pending |
| BID-01 | Phase 4 | Pending |
| BID-02 | Phase 4 | Pending |
| BID-03 | Phase 4 | Pending |
| DOC-01 | Phase 5 | Pending |
| DOC-02 | Phase 5 | Pending |
| DOC-03 | Phase 5 | Pending |

**Coverage:**

- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-25*
*Last updated: 2026-08-25 after initial definition*
