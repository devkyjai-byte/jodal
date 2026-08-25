# Phase 1: 준비 (Prep) - Research

**Researched:** 2026-08-25
**Domain:** 공공데이터포털 나라장터 Open API 신청 절차 · 조달 분류체계 · DB 스키마 설계 패턴 · .co.kr 도메인 등록
**Confidence:** MEDIUM (정부 포털의 공식 원문 페이지는 JS 렌더링/다운로드 문서 의존이 커 WebFetch로 전문을 확인하지 못한 항목이 있음. 핵심 절차·구조는 교차 검증했으나 세부 필드 목록은 활용신청 단계에서 Swagger/참고자료 문서로 재확인 필요.)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**서비스명·도메인**
- **D-01:** 서비스명은 "조달메이트"로 확정한다. 이미 PROJECT.md, ROADMAP.md, GitHub 저장소 설명, Artifact 문서 전반에 사용된 이름을 그대로 유지한다.
- **D-02:** 도메인은 `.co.kr` 형식을 우선한다(예: jodalmate.co.kr) — 국내 B2B/조달 업체 대상 서비스는 `.co.kr`이 신뢰도 면에서 유리하다는 판단.
- **D-03:** 도메인 구매는 사용자가 직접 진행한다 — 결제수단이 필요해 Claude가 대신 수행할 수 없는 사용자 액션 항목. Phase 1 계획에는 "도메인 확보"를 사용자 체크리스트 항목으로 남긴다.

**DB 스키마 설계 범위**
- **D-04:** Phase 1에서는 Phase 2(MVP)에 직접 필요한 핵심 테이블만 구체화한다 — 업체 프로필(업종·지역·실적·인증), 공고(정규화된 레코드), 매칭 결과, 알림 발송 이력 등. Reversibility: costly.
- **D-05:** 자격판정·낙찰통계·AI서류작성 관련 테이블은 Phase 1에서 설계하지 않는다.

**업종코드 매핑 기준**
- **D-06:** 업종코드 매핑은 나라장터 물품분류번호(품목분류) 체계를 1차 기준으로 삼는다.
- **D-07:** 통계청 표준산업분류(KSIC)는 이번 Phase에서 별도 매핑 테이블로 만들지 않는다.
- **D-08:** 매핑은 목표 업종 3~5개로 시작한다.

**와이어프레임 산출물**
- **D-09:** 와이어프레임은 실제 시각 목업이 아니라 화면별 컴포넌트·레이아웃·상호작용을 정리한 텍스트 명세로 남긴다.
- **D-10:** Phase 1 와이어프레임은 MVP 핵심 4화면만 다룬다 — ① 온보딩/업체 프로필 등록, ② 공고 피드(매칭된 공고 목록), ③ 공고 상세, ④ 알림 설정.

### Claude's Discretion
- DB 스키마의 정확한 컬럼명·타입·인덱스 설계는 Phase 1 실행(plan-phase → execute-phase) 중 Claude가 표준 관례를 따라 결정한다.
- 업종코드-물품분류번호 매핑 데이터의 구체적 소싱 방법(공공데이터포털 API 직접 조회 vs 수동 CSV)은 실행 시점에 API 문서를 확인한 뒤 판단한다.
- 텍스트 와이어프레임의 정확한 문서 형식(마크다운 표 vs 섹션별 목록)은 Claude가 읽기 좋은 형태로 자유롭게 구성한다.

### Deferred Ideas (OUT OF SCOPE)
- KSIC(표준산업분류) 이중 매핑 — Phase 1에서는 나라장터 물품분류번호만 사용. 필요해지면 이후 Phase에서 추가.
- 자격판정·낙찰통계·AI서류작성 화면의 와이어프레임 — 각 기능이 시작되는 Phase(4, 5, 6)에서 다룬다.
</user_constraints>

## Summary

Phase 1은 코드를 작성하지 않는 "제도적·설계적 전제조건 확정" 단계다. 네 가지 산출물이 필요하다: (1) 공공데이터포털 나라장터 Open API 4종의 활용신청 완료, (2) 업종코드↔물품분류번호 매핑 설계 문서, (3) 핵심 DB 스키마 + 텍스트 와이어프레임, (4) 서비스명·도메인 확정. 이 중 (1)과 (4)는 외부 서비스에 대한 사용자 액션(로그인, 결제)이 포함돼 Claude가 대행할 수 없는 부분이 있으므로, 계획은 "Claude가 준비할 수 있는 것(신청 양식 작성 가이드, 문서 초안)"과 "사용자가 직접 눌러야 하는 것(활용신청 제출, 도메인 결제)"을 명확히 분리해야 한다.

가장 중요한 발견은 나라장터에 **서로 다른 두 개의 코드 체계**가 존재한다는 점이다: ① **업종코드**(조달청에 등록하는 참가자격 코드, 4자리류, 예: 소프트웨어사업=1468)와 ② **물품분류번호**(UNSPSC 기반 8자리, 예: 43211507=노트북컴퓨터)다. 공고문은 물품분류번호로 태깅되므로, CONTEXT.md D-06 결정대로 매칭 정확도를 위해서는 업체 프로필이 물품분류번호(또는 그 상위 대분류/중분류)를 직접 보유해야 한다. NTS 사업자등록증의 업태/종목이나 G2B 업종코드에서 물품분류번호로 자동 변환해주는 공식 매핑 API는 이번 세션에서 확인되지 않았다 — 따라서 Phase 1 설계 문서는 "온보딩 시 업체가 물품분류 대분류/중분류를 직접 선택"하는 방식을 권장안으로 제시해야 한다(목표 업종 3~5개로 시작하는 D-08과 정합적).

API 활용신청은 자동승인(개발계정, 문서 수정 없이 즉시~30분) 방식이 우선 시도 경로이며, 승인까지 "수일"이 걸릴 수 있다는 STATE.md의 우려는 운영계정(트래픽 상향 필요 시) 또는 심의승인 대상 서비스에 한해 해당될 가능성이 높다. 4개 서비스 각각의 승인 방식(자동/심의)은 활용신청 화면에서 개별 확인이 필요하다.

**Primary recommendation:** Phase 1 계획을 "① API 활용신청 준비/제출(사용자 액션 포함) → ② 물품분류번호 기반 매핑 설계 문서 작성 → ③ 핵심 4테이블 스키마 설계 → ④ 4화면 텍스트 와이어프레임 → ⑤ 서비스명·도메인 확정(사용자 액션 포함)"의 5개 산출물 트랙으로 나누고, 사용자 액션이 필요한 항목은 `checkpoint:human-verify` 또는 명시적 사용자 체크리스트로 표시한다.

## Architectural Responsibility Map

Phase 1은 코드를 생성하지 않지만, 설계 산출물(스키마·매핑·와이어프레임)이 어느 아키텍처 계층에 귀속되는지 미리 정리해두면 Phase 2 planner가 테이블/화면을 올바른 계층에 배치할 수 있다. (jodal 원본 문서의 5-레이어 구조 기준.)

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 나라장터 API 데이터 수집 | API/Backend (Ingestion 배치) | Database (적재) | 외부 API 폴링은 서버 사이드 스케줄러(Redis+BullMQ) 책임 — 브라우저에서 직접 호출 불가(인증키 노출) |
| 업체 프로필 저장(업종·지역·실적·인증) | Database / API·Backend | — | PROF-01~05는 서버가 검증 후 저장하는 영속 데이터 — 클라이언트는 폼 입력만 담당 |
| 공고 정규화 레코드 | Database | API/Backend(파서) | 원문 파싱은 Ingestion 계층, 정규화 결과는 DB에 영속 |
| 매칭 결과 | Database | API/Backend(스코어링 엔진) | 매칭 스코어 계산은 코어 엔진(서버), 결과는 DB에 캐시/저장되어 알림·피드 조회에 재사용 |
| 알림 발송 이력 | Database | API/Backend(발송 워커) | 발송 성공/실패 추적은 서버측 큐 워커가 기록 |
| 공고 피드·상세·온보딩·알림설정 화면 | Frontend (Next.js PWA, SSR+클라이언트) | API/Backend(데이터 제공) | CLIENT-01 요구사항 — 화면은 프론트엔드 계층, 데이터는 API가 공급 |
| .co.kr 도메인/DNS | CDN/Infra | — | 도메인 등록은 배포 인프라 계층 관심사, 애플리케이션 로직과 무관 |

## Standard Stack

Phase 1은 패키지를 설치하지 않는다(설계 전용). 아래는 PROJECT.md/jodal에 이미 확정된 스택을 계승 확인한 것으로, 새로 조사·결정한 것이 아니라 Phase 2 스키마 설계 시 문법 정합성을 맞추기 위한 참고용이다.

| Layer | Choice | Source | Note |
|-------|--------|--------|------|
| 데이터베이스 | PostgreSQL | [CITED: PROJECT.md 제약조건] | 스키마 설계는 Postgres DDL 관례(SERIAL/UUID PK, JSONB, GIN 인덱스) 기준으로 작성 |
| 백엔드 | NestJS 또는 FastAPI | [CITED: PROJECT.md 제약조건] | 어느 쪽이든 ORM(TypeORM/Prisma 또는 SQLAlchemy)을 쓴다는 전제로 스키마를 설계 — Phase 1에서는 ORM 결정 불필요 |
| 프론트엔드 | Next.js + TypeScript (PWA) | [CITED: PROJECT.md 제약조건] | 와이어프레임 명세의 컴포넌트 구조는 Next.js 페이지/컴포넌트 단위로 서술 |

이번 Phase는 신규 패키지 설치가 없으므로 Package Legitimacy Audit 대상이 없다(아래 섹션 참조).

## Package Legitimacy Audit

**해당 없음 — 이 Phase는 애플리케이션 코드나 패키지를 설치하지 않는다 (설계 문서·API 신청만 산출).** Phase 2(MVP)에서 실제 프레임워크/ORM 패키지를 설치할 때 이 게이트를 다시 적용해야 한다.

## Architecture Patterns

### 나라장터 두 코드 체계 — 반드시 구분

가장 중요한 설계 함정: 나라장터에는 이름이 비슷하지만 목적이 다른 두 코드 체계가 있다.

| 구분 | 업종코드 | 물품분류번호(분류코드) |
|------|---------|----------------------|
| 목적 | 업체의 참가자격(어떤 업종으로 입찰 참여 가능한지) 식별 | 조달 물품·용역·공사 자체의 성격 분류 |
| 적용 대상 | 공급자(업체) | 공고·계약 대상 품목 |
| 형식 | 4자리류 코드 (예: 1468=소프트웨어사업, 1426=패키지소프트웨어개발·공급) | UNSPSC 기반 8자리 (2자리×4단계: 대분류-중분류-소분류-품명분류) |
| 등록/조회처 | 나의나라장터 > 업체정보관리 > 입찰참가자격변경신청 / data.g2b.go.kr | 목록정보사이트 goods.g2b.go.kr:8053 |
| 예시 | 전기공사업(0037), 소프트웨어사업(1468) | 43211507 = 윈도우 기반 데스크탑 PC (대분류 43=IT/방송통신) |

[CITED: lee-v.com/89 — 나라장터 계약등록 시 업종코드와 공공조달 분류코드 찾는 법] (MEDIUM confidence — 개인 블로그, 공식 data.g2b.go.kr/goods.g2b.go.kr 원문은 이번 세션에서 직접 열람하지 못함. 실행 시 원문 화면 캡처로 재검증 권장.)

**설계 함의:** CONTEXT.md D-06은 "물품분류번호를 1차 기준으로 삼는다"고 결정했다 — 이는 옳은 선택이다. 공고 자체가 물품분류번호로 태깅되어 있어 매칭 정밀도가 가장 높다. 반대로 업종코드(참가자격)나 NTS 사업자등록 업태/종목은 공고 데이터와 직접 조인되는 필드가 아니므로, 이걸 기준으로 매칭하면 별도의 변환 테이블이 필요하고 정확도가 떨어진다. **업체 프로필의 "업종코드" 입력 필드는 실제로는 물품분류번호(대분류/중분류 단위)를 다중 선택하는 UI로 설계하는 것을 권장** — PROF-01 요구사항 문구("업종코드")와 실제 저장 값(물품분류번호)이 다를 수 있음을 Phase 2 planner가 인지해야 한다.

### UNSPSC 대분류(Segment) 구조 및 목표 업종 후보

UNSPSC는 2자리씩 4단계(Segment-Family-Class-Commodity) 계층이다 [VERIFIED: 구조는 UNSPSC 표준 자체 규격이며 나라장터 예시(방검복 46181598)로 교차 확인됨 — MEDIUM]. 목표 업종 3~5개(추가 컨텍스트에서 제시된 예시: 정보통신, 소프트웨어개발, 사무용품, 시설관리)를 아래 대분류로 시작점 삼을 수 있다.

| 목표 업종(예시) | UNSPSC 대분류(Segment) 후보 | 비고 |
|-----------------|------------------------------|------|
| 정보통신 / 소프트웨어개발 | 43 — Information Technology Broadcasting and Telecommunications | [CITED: WebSearch, UNSPSC 표준] — 정확한 중분류(Family)/소분류(Class)는 goods.g2b.go.kr 목록정보사이트에서 실행 시점에 재조회 필요 |
| 사무용품 | 44 — Office Equipment and Accessories (추정 세그먼트 번호) | [ASSUMED] — 44번이 사무용품 관련 세그먼트라는 것은 UNSPSC 일반 지식에 근거하며, 나라장터가 동일 세그먼트 번호를 그대로 쓰는지는 실행 시 goods.g2b.go.kr에서 직접 검증 필요 |
| 시설관리 | 72 — Building and Facility Construction and Maintenance Services (추정) 또는 76 — Industrial Cleaning Services | [ASSUMED] — 서비스 계열은 물품이 아닌 용역 분류 체계를 따를 수 있어 조달청이 별도 용역분류를 쓰는지 확인 필요 |

**Open Question으로 하단에 기록** — 정확한 코드는 목록정보사이트(goods.g2b.go.kr:8053) 접속 후 직접 검색해야 하며, 이번 세션은 로그인/JS 렌더링 페이지라 자동화된 조회를 하지 못했다.

### 나라장터 Open API 4종 개요

| 서비스명 | data.go.kr 페이지 | 제공 정보(요약) |
|---------|--------------------|-------------------|
| 입찰공고정보서비스 | data.go.kr/data/15129394/openapi.do | 물품/용역/공사/외자 입찰공고목록, 공고상세정보, 기초금액정보, 면허제한정보, 참가가능지역정보, 공고 변경이력 [CITED: data.go.kr 15129394 — WebFetch 확인, MEDIUM] |
| 사전규격정보서비스 | data.go.kr/data/15129437/openapi.do | 업무구분별(물품/용역/공사/외자) 사전규격 공개정보 — 사전규격등록번호, 사업명, 배정예산액, 규격파일, 규격의견 [CITED: WebSearch, MEDIUM] |
| 낙찰정보서비스 | data.go.kr/data/15129397/openapi.do | 업무별 개찰결과 — 최종낙찰자, 개찰순위, 복수예비가격/예비가격, 낙찰률, 개찰완료·재입찰·유찰 목록 [CITED: WebFetch, MEDIUM] |
| 계약정보서비스 | data.go.kr/data/15129427/openapi.do | 업무별 계약 체결정보, 계약변경/해지 이력 — 계약체결일자, 계약번호, 공고번호, 발주/수요기관명, 품명, 계약방법, 계약참조번호 [CITED: WebSearch, MEDIUM] |

**정확한 오퍼레이션(엔드포인트)명, 요청/응답 파라미터 전체 목록은 각 서비스 상세페이지의 다운로드 문서("조달청_OpenAPI참고자료_...docx")와 웹 기반 Swagger UI에만 있다** — 로그인 없이 자동화 도구로 전문을 가져오지 못했다. Phase 1 실행 시 사람이 직접 로그인해 활용신청을 진행하면서 Swagger 문서를 확인하는 것이 가장 확실하다.

### API 활용신청 절차

1. data.go.kr 회원가입/로그인 (개인 또는 기업회원)
2. 대상 서비스 페이지에서 "활용신청" 클릭
3. 시스템 유형(일반/포털지원 등), 활용목적, 상세기능(오퍼레이션) 선택
4. 승인방식 확인 — **자동승인**: 개발계정 기준 신청 후 약 20~30분 뒤 "마이페이지 > API활용현황"에서 확인 가능, 일 평균 1,000건 트래픽 제공 / **심의승인**: 담당 기관 심사, 소요 시간은 서비스별로 상이(운영계정 전환 사례 기준 1~2일 보고됨) [CITED: WebSearch 교차검증, MEDIUM]
5. 승인 후 "일반 인증키 받기"로 서비스키(인증키) 발급 — 기업회원은 프로젝트 서비스키 또는 개인 서비스키 중 선택 가능 [CITED: WebSearch, MEDIUM]

**개발계정 → 운영계정 전환:** 서비스 출시 후 트래픽이 하루 1,000건을 넘으면 운영계정 신청(활용사례 등록 필요) 및 최대 10만 건/일 한도로 상향 가능하다는 것이 확인됐으나, 그 이상 상향에 대한 공식 절차 문서는 확인되지 않았다(QA 게시판 개별 요청 사례만 존재) [CITED: WebSearch, LOW-MEDIUM — Open Question으로 기록].

### 권장 프로젝트 산출물 구조 (Phase 1)

```
.planning/phases/01-prep/
├── 01-CONTEXT.md          (완료)
├── 01-RESEARCH.md         (이 문서)
├── 01-PLAN.md             (다음 산출물 — plan-phase가 생성)
└── (execute-phase 산출물 예상)
    ├── api-신청-체크리스트.md       # 4개 서비스 신청 상태·서비스키 관리(비밀키는 .env/SOPS, git 미포함)
    ├── db-schema-design.md          # 핵심 4테이블 ERD/DDL 스케치
    ├── 업종-물품분류-매핑.md         # 목표 3~5개 업종 ↔ 물품분류번호 매핑표
    └── wireframes/
        ├── 01-onboarding.md
        ├── 02-feed.md
        ├── 03-detail.md
        └── 04-notification-settings.md
```

### 핵심 DB 스키마 패턴 (PostgreSQL)

아래는 채용 매칭 플랫폼·B2B 리드 매칭 SaaS에서 널리 쓰이는 일반적 스키마 패턴을 조달메이트 도메인에 맞게 재구성한 것이다 — 특정 오픈소스 리포지토리를 그대로 인용한 것이 아니라 표준 관례에 기반한 설계 제안이므로 전부 **[ASSUMED]**로 표기한다. Phase 1 실행 시 Claude's Discretion 항목(정확한 컬럼명·타입·인덱스)에 따라 확정한다.

```sql
-- 업체 프로필 (PROF-01~05)
CREATE TABLE companies (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_reg_no    VARCHAR(10) NOT NULL UNIQUE,   -- 사업자등록번호, 암호화 저장 대상 (CLAUDE.md 제약)
  company_name       VARCHAR(255) NOT NULL,
  region_code        VARCHAR(10),                    -- 활동 지역 (시/도 or 시/군/구 코드)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 업체가 등록한 물품분류번호(목표 업종 매핑, D-06)
CREATE TABLE company_classification_codes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  classification_code VARCHAR(8) NOT NULL,           -- 물품분류번호(8자리) 또는 상위 대분류/중분류 prefix
  UNIQUE (company_id, classification_code)
);

-- 업체 실적
CREATE TABLE company_performances (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_name       VARCHAR(255),
  contract_amount    NUMERIC(15,0),
  contract_date      DATE,
  agency_name        VARCHAR(255)
);

-- 업체 보유 인증
CREATE TABLE company_certifications (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cert_type          VARCHAR(100),                   -- 예: ISO9001, 벤처기업인증, 여성기업 등
  cert_number        VARCHAR(100),
  expires_at         DATE
);

-- 공고 (정규화 레코드, ING-01~03)
CREATE TABLE bid_announcements (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_bid_no      VARCHAR(50) NOT NULL,           -- 나라장터 공고번호
  source_revision_no VARCHAR(10),                    -- 개정 차수 (중복/개정 병합 키)
  title              TEXT NOT NULL,
  classification_code VARCHAR(8),                    -- 물품분류번호
  region_code        VARCHAR(10),
  agency_name        VARCHAR(255),
  budget_amount       NUMERIC(15,0),
  bid_open_at        TIMESTAMPTZ,
  bid_close_at       TIMESTAMPTZ,
  raw_payload        JSONB,                          -- 원문 API 응답 보관(재파싱 대비)
  fetched_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_bid_no)                              -- 개정은 별도 이력 테이블 또는 revision 컬럼으로 병합 처리
);

-- 매칭 결과 (MATCH-01)
CREATE TABLE matches (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  announcement_id    UUID NOT NULL REFERENCES bid_announcements(id) ON DELETE CASCADE,
  score              NUMERIC(5,2) NOT NULL,
  matched_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, announcement_id)
);

-- 알림 발송 이력 (MATCH-02, MATCH-03)
CREATE TABLE notification_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id           UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  channel            VARCHAR(20) NOT NULL,           -- 'email' | 'push'
  status              VARCHAR(20) NOT NULL,           -- 'sent' | 'failed' | 'pending'
  sent_at            TIMESTAMPTZ,
  error_message      TEXT
);
```

**설계 근거 메모:**
- `raw_payload JSONB`는 원문 API 응답을 보관해 파싱 로직 변경 시 재처리 가능하게 하는 일반적 ingestion 패턴이다 [ASSUMED].
- `classification_code`를 `bid_announcements`와 `company_classification_codes` 양쪽에 두는 것은 D-06(물품분류번호 1차 기준) 결정을 스키마 레벨에서 직접 구현한 것이다.
- 중복/개정 공고 병합(ING-03)은 `source_bid_no` UNIQUE 제약 + 개정 시 UPSERT 전략을 제안하나, 정확한 병합 규칙(개정 시 이력을 별도 테이블에 남길지 여부)은 Phase 2 실행 시 결정할 사항으로 남긴다.
- 사업자등록번호(`business_reg_no`)는 CLAUDE.md/PROJECT.md 제약조건에 따라 애플리케이션 레벨 암호화(예: pgcrypto 또는 애플리케이션 레이어 AES) 대상이다 — 스키마 설계 문서에 "암호화 저장" 요구사항을 명시해야 한다.

### 텍스트 와이어프레임 명세 패턴 (D-09, D-10)

시각 목업 대신, 화면별로 아래 구조의 마크다운 섹션을 작성하는 방식을 권장한다:

```markdown
## 화면: [화면명]
**목적:** [한 줄 요약]
**진입 경로:** [어디서 이 화면에 도달하는가]

### 레이아웃 (상→하 또는 영역별)
1. [영역명] — [포함 컴포넌트, 표시 데이터]
2. ...

### 상호작용
- [사용자 행동] → [시스템 반응]

### 데이터 소스
- [이 화면이 참조하는 테이블/API]

### 엣지 케이스
- [빈 상태, 에러 상태, 로딩 상태]
```

4개 화면(온보딩/프로필 등록, 공고 피드, 공고 상세, 알림 설정) 각각에 이 템플릿을 적용하면 Phase 2 planner가 컴포넌트 단위 태스크로 바로 변환할 수 있다.

### Anti-Patterns to Avoid

- **업종코드와 물품분류번호를 동일시하는 매핑 설계:** 두 체계는 목적과 형식이 다르다(위 표 참고) — 하나의 테이블에 섞어 저장하면 매칭 정확도가 떨어지고 이후 재설계 비용이 커진다.
- **Phase 4~6용 테이블을 Phase 1에서 미리 설계:** D-05가 명시적으로 금지 — 자격판정·낙찰통계·서류작성 테이블은 해당 Phase 시작 시점에 설계한다.
- **와이어프레임 4화면 범위 초과:** D-10을 벗어나 자격판정 배지, 대시보드 등을 그리면 Phase 3 이후 범위와 충돌한다.
- **개발계정 트래픽(일 1,000건)만으로 운영 트래픽을 설계:** ING-01(일 4~6회 폴링)은 개발계정으로 충분할 수 있으나, 사용자 수 증가 시 운영계정 전환 시점을 스키마/큐 설계에 미리 고려해야 한다.

## Don't Hand-Roll

Phase 1은 코드를 작성하지 않지만, 설계 문서가 Phase 2 구현 방향을 결정하므로 "직접 구현하면 안 되는 것"을 미리 기록해 향후 Phase 재설계 비용을 줄인다.

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 사업자등록번호 진위 확인 | 자체 검증 로직 | 국세청 사업자등록정보 진위확인 API (공공데이터포털 별도 서비스) | PROF-05 요구사항 — 정규식만으로는 실재 여부를 확인할 수 없음 |
| 사업자등록번호 등 민감정보 암호화 | 커스텀 암호화 함수 | pgcrypto 또는 검증된 KMS/envelope encryption 라이브러리 | CLAUDE.md/PROJECT.md 제약 — 개인정보보호법·정보통신망법 준수 필요, 자체 구현은 취약점 위험 |
| 공고 원문 파싱(품목·지역·자격조건 추출) | 정규식만으로 완전 자동 파싱 | 구조화된 필드(API가 이미 제공하는 항목) 우선 사용 + 자유텍스트는 규칙기반 파서로 보조 | ING-02 — 낙찰정보서비스/입찰공고정보서비스가 이미 상당 부분 구조화된 필드를 제공하므로 전체를 텍스트 파싱으로 재발명할 필요 없음 |
| 전문 검색 인덱싱 | 자체 역색인 구현 | Meilisearch 또는 OpenSearch (PROJECT.md 기 결정 스택) | ING-04 검색·필터링 요구사항 — 검색엔진은 이미 스택으로 확정됨 |

**Key insight:** Phase 1의 설계 문서에 "이 값은 외부 검증 API/암호화 라이브러리로 처리한다"는 주석을 남겨두면, Phase 2 실행 중 자체 구현으로 새는 것을 방지할 수 있다.

## Common Pitfalls

### Pitfall 1: 업종코드-물품분류번호 혼동
**What goes wrong:** PROF-01 "업종코드(업태·품목)"이라는 요구사항 문구를 그대로 따라 NTS 업태/종목이나 G2B 참가자격 업종코드를 저장하면, 공고 매칭 시 물품분류번호와 조인할 방법이 없어진다.
**Why it happens:** 세 가지 코드 체계(NTS 업태/종목, G2B 업종코드, UNSPSC 물품분류번호)가 이름이 비슷해 혼용되기 쉽다.
**How to avoid:** 매핑 설계 문서에 세 체계를 표로 구분하고, 업체 프로필 저장 필드는 물품분류번호(D-06)로 명시.
**Warning signs:** 매핑 테이블에 "업종코드"라는 컬럼명만 있고 실제 값의 출처(어느 체계인지)가 문서에 없는 경우.

### Pitfall 2: API 승인 소요 시간 과소평가
**What goes wrong:** 개발계정 자동승인(20~30분)만 보고 전체 일정에 여유가 없다고 판단했다가, 운영계정 전환이나 특정 서비스의 심의승인 단계에서 예상보다 지연됨.
**Why it happens:** 4개 서비스 각각의 승인방식(자동/심의)이 다를 수 있고, 공식 문서에 명시적으로 나오지 않는다.
**How to avoid:** Phase 1 실행 초반(첫 태스크)에 4개 서비스 모두 활용신청을 "동시에" 제출하고, 승인 대기 중 다른 산출물(스키마, 와이어프레임)을 병렬로 진행.
**Warning signs:** 활용신청 후 마이페이지에 "승인대기"로 24시간 이상 표시.

### Pitfall 3: .co.kr 도메인을 즉시 확보 가능하다고 가정
**What goes wrong:** 도메인 등록이 결제 후 수분~1시간 내 완료된다는 정보만 믿고 별도 검증 없이 최종 확정.
**Why it happens:** 일반 도메인(예: .com)과 달리 .kr 계열은 KISA 도메인이름 관리준칙에 따른 추가 자격요건이 있을 수 있다(이번 세션에서 co.kr의 개인/법인 제한 여부를 명확히 확인하지 못함).
**How to avoid:** 계획에 "가비아/후이즈에서 jodalmate.co.kr 검색 → 등록 가능 여부·자격요건 확인 → 사용자가 직접 결제"를 체크포인트로 명시.
**Warning signs:** 도메인 검색 결과가 "등록 불가" 또는 사업자등록번호 필수로 표시되는 경우.

### Pitfall 4: DB 스키마를 Phase 3~6까지 미리 완성하려는 시도
**What goes wrong:** "나중에 재설계하면 비용이 크다(D-04 Reversibility: costly)"는 경고를 과잉 해석해 자격판정·낙찰통계 테이블까지 Phase 1에서 만들어버림.
**Why it happens:** FK/인덱스 재설계 비용에 대한 불안감.
**How to avoid:** D-05를 그대로 따른다 — Phase 1은 4개 핵심 테이블(업체 프로필군, 공고, 매칭, 알림)만. 확장 여지를 남기려면 `raw_payload JSONB` 같은 유연한 컬럼과 UUID PK(향후 FK 추가 용이)를 쓰는 정도로 충분하다.
**Warning signs:** 스키마 설계 문서에 ELIG/BID/DOC 관련 테이블명이 등장.

## Code Examples

이 Phase는 실행 코드를 생성하지 않으므로, 위 "핵심 DB 스키마 패턴" 섹션의 SQL 스케치가 유일한 코드 예시다. 이는 공식 소스에서 그대로 가져온 것이 아니라 표준 설계 관례에 기반한 제안이며 전부 `[ASSUMED]`다 — Phase 1 실행 시 Claude's Discretion에 따라 최종 컬럼명·타입을 확정해야 한다.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 사무용품 관련 UNSPSC 대분류가 44번이라는 추정 | Architecture Patterns > UNSPSC 대분류 | 매핑 설계 문서에 잘못된 대분류를 기재하면 목표 업종 매칭이 처음부터 어긋남 — goods.g2b.go.kr에서 실행 시 재검증 필수 |
| A2 | 시설관리 관련 UNSPSC 대분류가 72 또는 76번이라는 추정, 서비스(용역) 분류 체계가 물품분류번호와 동일 자릿수 구조를 따른다는 가정 | Architecture Patterns > UNSPSC 대분류 | 용역은 별도 분류 체계를 쓸 가능성 있음 — 확인 안 하면 시설관리 업종 매칭이 아예 동작하지 않을 수 있음 |
| A3 | 업체-물품분류-공고 매칭을 위한 DB 스키마 컬럼 구성(SQL 스케치 전체) | Architecture Patterns > 핵심 DB 스키마 패턴 | 표준 패턴이지만 도메인 특화 요구(예: 복수 지역, 복수 업종) 반영이 부족하면 Phase 2 초반 스키마 변경 필요 |
| A4 | .co.kr 도메인 등록에 개인/법인 자격 제한이 없거나 있는지 불명확 — "제한 없을 가능성이 있다"는 잠정 결론 | Common Pitfalls > Pitfall 3 | 실제로 사업자등록번호가 필수라면 사용자의 도메인 확보 체크리스트에 서류 준비 단계 추가 필요 |
| A5 | 4개 나라장터 서비스 모두 자동승인이라는 확정적 근거 없음 — 서비스별 상이할 수 있다는 잠정 결론 | Architecture Patterns > API 활용신청 절차 | 심의승인 서비스가 있다면 활용신청을 최우선으로 먼저 제출해야 하는 일정 리스크가 실제로 존재 |
| A6 | 운영계정 트래픽 상향(일 10만 건 초과)의 공식 절차가 QA 게시판 개별 요청뿐이라는 결론 | Architecture Patterns > API 활용신청 절차 | 서비스 성장 시 트래픽 병목이 될 수 있음 — 실제로는 공식 상향 신청 양식이 있을 수 있으므로 재확인 필요 |

## Open Questions

1. **UNSPSC 대분류 44/72/76이 나라장터 물품분류번호 체계에서 실제로 사무용품·시설관리에 해당하는가?**
   - What we know: UNSPSC 표준 자체의 세그먼트 번호 체계(일반 지식)와, 나라장터가 UNSPSC 기반이라는 사실(교차 확인됨)
   - What's unclear: 나라장터가 표준 UNSPSC 세그먼트 번호를 그대로 쓰는지, 국내 실정에 맞게 재배열했는지
   - Recommendation: 실행 시 goods.g2b.go.kr:8053/search/classificationSearch.do 에서 "사무용품", "시설관리", "소프트웨어" 키워드로 직접 검색해 정확한 코드를 확정. 계획에 이 조회를 명시적 태스크로 포함.

2. **4개 API 서비스 각각의 승인방식(자동승인 vs 심의승인)은?**
   - What we know: 공공데이터포털 전반의 자동승인/심의승인 구분과 대략적 소요시간
   - What's unclear: 조달청_나라장터 입찰공고정보/사전규격/낙찰정보/계약정보 서비스 각각이 어느 방식인지
   - Recommendation: Phase 1 실행 첫 태스크로 4개 서비스 모두 활용신청을 동시 제출하고 승인방식을 관찰. 심의승인 서비스가 있다면 승인 대기 시간을 일정에 반영.

3. **.co.kr 도메인 등록에 사업자등록번호가 필수인가, 개인도 가능한가?**
   - What we know: 가비아 등 등록대행업체를 통한 일반 등록 절차, or.kr 등 일부 도메인은 등록자격 제한이 있음
   - What's unclear: co.kr 자체의 자격 제한 여부(KISA 도메인이름 관리준칙 원문 미확인)
   - Recommendation: 사용자가 도메인 등록 시 가비아/후이즈 검색 화면에서 직접 확인. 사업자등록번호가 필요하다면 이미 확보되어 있는지 사전 확인(1인 개발 창업 초기 단계라 사업자등록 여부가 불확실할 수 있음).

4. **개발계정(일 1,000건) 트래픽으로 ING-01(일 4~6회 폴링)이 충분한가?**
   - What we know: 폴링은 일 4~6회로 계획되어 있어 횟수 자체는 적음. 다만 1회 폴링당 다건의 공고 목록/상세 API 호출이 발생할 수 있음(공고 수백~수천 건일 경우 페이지네이션 호출 다수 발생 가능)
   - What's unclear: 페이지당 최대 결과 수, 1일 총 호출 수가 1,000건을 넘는지 여부
   - Recommendation: Phase 2 실행 시 실제 응답의 페이지네이션 구조를 확인하고 캐싱 전략(변경분만 재조회 등)을 설계. Phase 1에서는 개발계정으로 시작하고 운영계정 전환 시점을 매핑 설계 문서에 리스크로 기록.

## Environment Availability

이 Phase는 로컬 CLI 도구나 런타임 의존성이 없다 — 모든 외부 의존성이 사람이 브라우저로 로그인해 처리하는 웹 서비스(data.go.kr, 도메인 등록대행업체)이므로 `command -v` 류의 자동 프로빙이 적용되지 않는다.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| data.go.kr 계정 | API 활용신청(SC-1) | 미확인 — 사용자 액션 필요 | — | 없음(필수 사용자 액션) |
| 도메인 등록대행업체 계정(가비아/후이즈 등) | 도메인 확정(SC-4, D-03) | 미확인 — 사용자 액션 필요 | — | 없음(필수 사용자 액션, 결제수단 필요) |

**Missing dependencies with no fallback:**
- data.go.kr 계정 로그인 및 활용신청 제출 — Claude가 대행 불가, 사용자 체크리스트 항목으로 계획에 포함
- 도메인 결제 — Claude가 대행 불가(D-03), 사용자 체크리스트 항목으로 계획에 포함

## Validation Architecture

> 이 Phase는 애플리케이션 코드를 생성하지 않으므로 자동화 테스트(pytest/jest 등)가 적용되지 않는다. 대신 4개 Success Criteria를 "산출물 존재·완결성 확인"이라는 수동 검증 체크리스트로 치환한다.

### 검증 방식
| Property | Value |
|----------|-------|
| 프레임워크 | 없음 (설계 산출물 검토 — 코드 없음) |
| 검증 방법 | 산출물 파일 존재 확인 + 내용 완결성 체크리스트 (사람 검토) |
| 실행 명령 | 해당 없음 |

### Success Criteria → 검증 방법 매핑
| SC | 내용 | 검증 방법 | 자동화 가능 여부 |
|----|------|-----------|-------------------|
| SC-1 | 나라장터 API 4종 활용신청 완료 | data.go.kr 마이페이지 > API활용현황에서 4개 서비스 모두 "승인" 상태 확인 (스크린샷 또는 상태 텍스트로 기록) | 아니오 — 사람이 로그인해 확인 |
| SC-2 | 업종코드↔조달분류체계 매핑 설계 문서 존재 | `업종-물품분류-매핑.md` 파일 존재 + 목표 업종 3~5개 각각에 물품분류번호가 매핑되어 있는지 확인 | 파일 존재는 자동 확인 가능, 내용 정확성은 사람 검토 |
| SC-3 | 핵심 DB 스키마·와이어프레임 확정 | `db-schema-design.md`(4개 핵심 테이블 포함) + `wireframes/`(4개 화면 파일) 존재 확인 | 파일 존재/개수는 자동 확인 가능 |
| SC-4 | 서비스명·도메인 확정 | ROADMAP.md/PROJECT.md에 서비스명 "조달메이트" 이미 기재됨(확정) + 도메인은 사용자가 등록 완료 여부 보고 | 서비스명은 이미 완료, 도메인은 사람 확인 |

### Wave 0 Gaps
- 없음 — 이 Phase는 테스트 프레임워크가 필요하지 않다(코드 없음). Phase 2 실행 시 실제 테스트 인프라(pytest/jest) Wave 0 갭 분석을 별도로 수행해야 한다.

## Security Domain

> `security_enforcement: true` (config.json) — 이 Phase는 코드를 작성하지 않으므로 즉시 시행할 통제는 없지만, 설계 문서에 반영해야 할 보안 요구사항을 기록한다. 실제 구현·시행은 Phase 2에서 이뤄진다.

### Applicable ASVS Categories (Phase 2 스키마 구현 시 적용 대상 — Phase 1은 설계에만 반영)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | 예 (Phase 2) | 사업자등록번호 기반 가입·인증(PROF-05) — 비밀번호/세션 관리는 검증된 라이브러리(NestJS Passport 또는 FastAPI 표준 인증) 사용 |
| V5 Input Validation | 예 (설계 문서에 명시) | 스키마 설계 문서에 각 필드의 타입·길이 제약을 명시(예: `business_reg_no VARCHAR(10)`)해 Phase 2 구현 시 검증 로직의 기준이 되게 함 |
| V6 Cryptography | 예 (설계 문서에 명시) | 사업자등록번호 등 민감정보는 저장 시 암호화(pgcrypto 또는 애플리케이션 레벨 AES) — CLAUDE.md/PROJECT.md 제약조건에 명시된 법적 요구사항. 커스텀 암호화 알고리즘 자체 구현 금지 |
| V9 Communication | 예 (Phase 2, 인프라) | 나라장터 API 인증키는 HTTPS로만 전송, 서버 환경변수(.env/SOPS)에 보관하고 절대 클라이언트/git에 노출 금지 |

### Known Threat Patterns for 이 스택 (Phase 1 설계 시 고려)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| API 인증키(서비스키) 유출 | Information Disclosure | 인증키를 git에 커밋하지 않음 — `.gitignore`/SOPS로 관리, 스키마·문서 어디에도 실제 키값을 예시로 남기지 않음 |
| 사업자등록번호 평문 저장 | Information Disclosure | DB 스키마 설계 문서에 "암호화 저장" 주석을 명시적으로 남겨 Phase 2 구현 누락 방지 |
| 공고 원문 파싱 결과와 원문 불일치로 인한 사용자 손해 | Tampering(데이터 신뢰성) | jodal 리스크 목록의 "원문 확인 필수" 고지 요구사항을 와이어프레임(공고 상세 화면)에 UI 요소로 반영 — 예: "원문 보기" 링크 필수 배치 |

## Sources

### Primary (HIGH confidence)
- (없음 — 이번 세션은 공식 API 참고자료 문서(docx)·Swagger UI에 로그인 없이 접근하지 못해 HIGH confidence 소스를 확보하지 못함)

### Secondary (MEDIUM confidence)
- data.go.kr — 조달청_나라장터 입찰공고정보서비스 (data.go.kr/data/15129394/openapi.do) — WebFetch로 페이지 요약 확인
- data.go.kr — 조달청_나라장터 낙찰정보서비스 (data.go.kr/data/15129397/openapi.do) — WebFetch로 페이지 요약 확인
- data.go.kr — 조달청_나라장터 사전규격정보서비스 (data.go.kr/data/15129437/openapi.do) — WebSearch로 확인
- data.go.kr — 조달청_나라장터 계약정보서비스 (data.go.kr/data/15129427/openapi.do) — WebSearch로 확인
- lee-v.com/89 — 나라장터 업종코드·공공조달 분류코드 구분 설명 (WebFetch)
- 공공데이터포털 개발계정/운영계정 트래픽·승인 절차 관련 다수 WebSearch 결과 교차확인 (elancer.co.kr, gyeongnam.go.kr, gb.go.kr 등 공공기관/대행 채널 설명 페이지)

### Tertiary (LOW confidence)
- UNSPSC 세그먼트 44/72/76 번호가 나라장터 사무용품/시설관리에 대응한다는 추정 — 국내 실사이트에서 재검증 필요
- co.kr 도메인 등록 자격 제한 여부 — KISA 원문 미확인

## Metadata

**Confidence breakdown:**
- API 활용신청 절차 전반: MEDIUM — 여러 WebSearch 결과가 일관되게 개발계정/운영계정 트래픽 수치를 보고하나, 4개 서비스 개별 승인방식은 미확인
- 코드 체계 구분(업종코드 vs 물품분류번호): MEDIUM — 2개 독립 출처(WebSearch 요약 + lee-v.com 블로그 WebFetch)가 일치하나 공식 정부 원문은 미확인
- DB 스키마 패턴: LOW-MEDIUM(설계 제안) — 표준 관례에 기반한 제안이며 프로젝트 특화 검증은 Phase 2 실행 시 필요
- .co.kr 도메인 등록 절차: MEDIUM — 일반 절차는 확인, 자격 제한 여부는 미확인(Open Question)

**Research date:** 2026-08-25
**Valid until:** 2026-09-08 (약 2주 — 정부 API 정책·트래픽 한도는 공지 없이 변경될 수 있어 짧은 유효기간 권장)
