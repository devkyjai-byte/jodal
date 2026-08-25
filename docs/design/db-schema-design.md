> 이 문서는 설계 참고 문서이며 실행 코드가 아니다. 아래 SQL 은 마크다운 코드블록 안의 설계 스케치이며 마이그레이션 파일이 아니다.

# DB 스키마 설계 문서

## 결론 먼저

이 스키마가 답하는 질문은 하나다 — **어떤 업체에게 어떤 공고를 왜 보여줄 것인가**. 설계 대상 테이블은 4개 도메인으로 묶인다: 업체 프로필군(`companies`, `company_classification_codes`, `company_performances`, `company_certifications`) / 공고(`bid_announcements`) / 매칭(`matches`) / 알림(`notification_logs`, `notification_settings`). 이 8개 테이블은 CONTEXT.md **D-04**(Phase 2 MVP에 직접 필요한 핵심 테이블만 구체화)를 근거로 확정한다. Phase 4~6 전용 테이블(자격판정 결과·낙찰통계·서류초안)은 **D-05**에 따라 이 문서에서 설계하지 않는다 — 해당 Phase 착수 시점에 별도로 설계한다. 저장 스택은 PostgreSQL이며, 기본키는 UUID, 시각 컬럼은 TIMESTAMPTZ, 반정형 원문 보관은 JSONB 관례를 따른다.

## 데이터 흐름 스파인

이 문서의 척추다. **분기 없는 단 하나의 경로**를 다음 시나리오로 서술한다: 업체 A가 온보딩에서 물품분류 대분류 `43`(정보기술방송통신) 하나만 선택했고, Ingestion 배치가 분류코드 `43211501`인 공고 1건을 수집했으며, 그 결과 업체 A에게 이메일 알림 1건이 나간다.

### ① 업체 등록

- **어느 테이블에 무슨 행이 생기는가:** `companies` 1행(업체 A의 기본 정보), `company_classification_codes` 1행(`classification_code = '43'`).
- **어느 컬럼이 읽히는가:** 온보딩 화면(`docs/design/wireframes/01-onboarding.md` 스텝 1·2)이 `companies.id`, `companies.company_name`, `company_classification_codes.classification_code`를 쓴다.
- **어느 키로 다음 단계와 연결되는가:** `company_classification_codes.company_id` → `companies.id` (FK). 이 `classification_code = '43'` 값이 ③ 단계의 prefix 대조 기준이 된다.

### ② 공고 수집

- **어느 테이블에 무슨 행이 생기는가:** `bid_announcements` 1행 — `classification_code = '43211501'`, 원문 API 응답 전체를 `raw_payload`(JSONB)에 보관.
- **어느 컬럼이 읽히는가:** Ingestion 배치가 `source_bid_no`, `classification_code`, `raw_payload`를 채운다.
- **어느 키로 다음 단계와 연결되는가:** `bid_announcements.classification_code`가 ③ 단계에서 업체의 prefix와 `LIKE` 대조된다. `bid_announcements.id`는 ③의 `matches.announcement_id`가 된다.

### ③ prefix 대조로 매칭

- **어느 테이블에 무슨 행이 생기는가:** `matches` 1행 — `company_id = 업체 A`, `announcement_id = 해당 공고`, `score`, `matched_at`.
- **어느 컬럼이 읽히는가:** 매칭 엔진이 `company_classification_codes.classification_code`(`'43'`)와 `bid_announcements.classification_code`(`'43211501'`)를 대조한다 — `'43211501'`이 `'43'`으로 시작하므로 매칭 후보가 된다(`docs/design/업종-물품분류-매핑.md` §매칭 규칙 (a)).
- **어느 키로 다음 단계와 연결되는가:** `matches.id`가 ④·⑤ 단계에서 `notification_logs.match_id`로 이어진다.

### ④ 발송 여부 판단

- **어느 테이블에 무슨 행이 생기는가:** 새 행이 생기지 않는다 — 기존 `notification_settings` 1행을 조회만 한다.
- **어느 컬럼이 읽히는가:** `notification_settings.email_enabled`(채널 on/off)와 `notification_settings.min_score_threshold`(적합도 임계값)를 `matches.score`와 비교해 발송 여부를 판단한다.
- **어느 키로 다음 단계와 연결되는가:** `notification_settings.company_id = matches.company_id`. 조건을 만족하면 ⑤로 진행한다.

### ⑤ 발송 기록

- **어느 테이블에 무슨 행이 생기는가:** `notification_logs` 1행 — `match_id`, `channel = 'email'`, `status = 'sent'`, `sent_at`.
- **어느 컬럼이 읽히는가:** 발송 워커가 `channel`, `status`, `sent_at`을 기록한다.
- **어느 키로 다음 단계와 연결되는가:** `notification_logs.match_id = matches.id` — 이 경로의 마지막 연결이며, 같은 `(match_id, channel)` 조합으로는 다시 발송되지 않는다(아래 §스파인이 강제하는 설계 제약 (d)).

아직 알림이 나가지 않은 (업체, 공고) 후보를 뽑는 조인 SQL은 다음과 같다. `companies` → `company_classification_codes` → `bid_announcements`(prefix 대조) → `matches` → `notification_logs`(미발송 조건)를 모두 통과하며, 모든 조회가 `company_id`로 스코프된다.

```sql
SELECT
  c.id            AS company_id,
  c.company_name,
  ba.id           AS announcement_id,
  ba.title,
  ba.classification_code,
  m.id            AS match_id,
  m.score
FROM companies c
JOIN company_classification_codes ccc
  ON ccc.company_id = c.id
JOIN bid_announcements ba
  ON ba.classification_code LIKE ccc.classification_code || '%'
JOIN matches m
  ON m.company_id = c.id
 AND m.announcement_id = ba.id
LEFT JOIN notification_logs nl
  ON nl.match_id = m.id
 AND nl.channel = 'email'
WHERE c.id = :company_id          -- 모든 조회는 company_id 로 스코프된다
  AND nl.id IS NULL                -- 이메일 채널로 아직 발송되지 않은 매칭만 후보로 남긴다
ORDER BY m.score DESC;
```

이 스파인의 prefix 대조 규칙(`LIKE ccc.classification_code || '%'`)은 `docs/design/업종-물품분류-매핑.md` §매칭 규칙에서 그대로 가져온 것이다 — 그 문서가 조인 키 설계의 원본이고, 이 스파인은 그 결정을 물리 조인 경로로 옮긴 것일 뿐이다.

## 스파인이 강제하는 설계 제약

위 경로를 실제로 성립시키기 위해 스키마가 반드시 만족해야 하는 제약 4가지다.

**(a) 분류코드 컬럼은 고정 8자리가 아니다.**
- **결정:** `classification_code` 컬럼의 저장 값 자릿수는 `2, 4, 6, 8`로 가변이다. `VARCHAR(8)` 타입 자체는 이미 가변 길이라 문제가 없지만, 허용 자릿수 집합을 SQL `CHECK` 제약으로 `length(classification_code) IN (2, 4, 6, 8)`처럼 못 박고, 숫자만 허용하는 정규식 패턴 제약(`~ '^[0-9]+$'`)도 함께 건다.
- **근거:** `docs/design/업종-물품분류-매핑.md` §프로필 저장 형식 권장안 — 업체마다 선택 정밀도(대분류만/중분류까지)가 다르다.
- **어기면 무슨 일이 일어나는가:** 애플리케이션·쿼리가 "항상 8자리"를 가정하면, 대분류(`43`)만 등록한 업체는 아예 매칭되지 않거나 저장 자체가 거부된다 — 매핑 문서가 명시적으로 경고한 실패 모드다.

**(b) prefix 매칭을 인덱스로 지원하는 방법을 2가지 제시하고 하나를 권장안으로 고른다.**
- (i) **btree pattern-ops 인덱스 + 리터럴 prefix 범위 스캔.** 공고 쪽 `bid_announcements.classification_code`에 `varchar_pattern_ops` btree 인덱스를 걸고, `classification_code LIKE '43%'`처럼 업체의 등록값이 **리터럴 prefix**로 고정된 조회에서 인덱스 레인지 스캔을 태운다. 한계: 업체마다 등록한 prefix 값이 다르므로 조인 조건이 `ba.classification_code LIKE ccc.classification_code || '%'`처럼 **컬럼 대 컬럼**이 되면, 옵티마이저가 우변을 상수로 취급하지 못해 인덱스를 못 탈 수 있다(런타임에 결정되는 패턴).
- (ii) **prefix 전개 후 등가 조인.** 공고의 8자리 분류코드를 애플리케이션 또는 뷰에서 2/4/6/8자리 prefix 4개로 전개해(예: `43`, `4321`, `432115`, `43211501`) 별도 컬럼·행으로 저장하고, 업체의 등록값과 **등가(`=`) 조인**한다. 등가 조인은 일반 btree 인덱스로 항상 인덱스를 탄다는 장점이 있으나, 공고 1건당 최대 4개의 파생 행/값을 유지해야 하는 저장·갱신 비용이 늘어난다.
- **권장안:** (i) btree `varchar_pattern_ops` 인덱스를 기본으로 채택한다 — 이 스키마는 공고 수가 업체 수보다 훨씬 많고(다대일에 가까운 조회 패턴), 실무에서는 업체 쪽 prefix 목록이 적어(1인당 수 개) 애플리케이션 레벨에서 업체의 prefix 목록을 먼저 읽은 뒤 `classification_code LIKE '43%' OR classification_code LIKE '4412%' OR ...`처럼 **리터럴 상수 OR 절**로 풀어서 질의하면 (i)의 한계(컬럼 대 컬럼 조인)를 피하면서 인덱스를 그대로 활용할 수 있다. (ii)는 공고 갱신마다 파생 데이터를 다시 만들어야 해 Ingestion 배치의 복잡도를 높인다. 실측 검증(`EXPLAIN ANALYZE`)은 Phase 2의 몫으로 남긴다.

**(c) 분류코드가 비어 있는 공고를 후보에서 배제하지 않는다.**
- **결정:** `bid_announcements.classification_code`는 NULL을 허용한다. NULL인 공고는 제목·본문 키워드 경로로 넘겨 보조 판정 후보에 남긴다.
- **근거:** `docs/design/업종-물품분류-매핑.md` §매칭 규칙 (c) — "분류코드 결측이 곧 관련 없음을 의미하지 않는다."
- **어기면 무슨 일이 일어나는가:** 원문 파싱 실패로 분류코드를 못 얻은 공고가 전부 매칭에서 사라져, 실제로는 관련 있는 공고를 사용자가 놓친다 — 핵심 가치("원하는 조달 공고를 놓치지 않는다")와 정면으로 충돌한다. 위 스파인 SQL은 이 NULL 경로를 다루지 않는다 — 스파인은 단일 happy path만 서술한다.

**(d) 같은 매칭에 같은 채널로 알림이 두 번 나가지 않는다.**
- **결정:** `notification_logs`에 `UNIQUE (match_id, channel)` 제약을 둔다. 배치 재시도·중복 실행 시에는 새 행을 추가하는 것이 아니라 기존 행의 `status`·`sent_at`·`error_message`를 갱신한다.
- **근거:** MATCH-02·MATCH-03 — 같은 공고에 대해 같은 채널로 반복 발송되면 사용자 경험이 나빠지고 스팸으로 인식될 수 있다.
- **어기면 무슨 일이 일어나는가:** 배치 스케줄러가 재시도할 때마다 같은 이메일이 반복 발송되어, 알림이 "필요한 만큼만" 오게 하려는 알림 설정 화면(`04-notification-settings.md`)의 전제 자체가 무너진다.

## 테이블 정의

4개 도메인 순서로 8개 테이블을 정의한다. 기본키는 모두 UUID(`gen_random_uuid()`) — Phase 4~6에서 FK를 덧붙이기 쉽고 분산 생성 시 충돌이 없기 때문이다. 시각 컬럼은 모두 TIMESTAMPTZ — 서버·클라이언트 타임존이 달라도 항상 UTC 기준으로 비교 가능하기 때문이다. 금액은 NUMERIC(15,0) — 부동소수점 오차 없이 원 단위 정수 금액을 정확히 저장하기 위함이다.

### 업체 프로필군

```sql
CREATE TABLE companies (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name              VARCHAR(255) NOT NULL,
  contact_email             VARCHAR(255) NOT NULL,
  region_codes              VARCHAR(10)[] NOT NULL DEFAULT '{}',  -- 활동 지역 시/도 코드, 복수 선택 (PROF-02, §복수성·병합 규칙 (a))
  -- 사업자등록번호: 평문 컬럼을 두지 않는다. 아래 두 컬럼으로 분리 저장한다 (§민감정보 저장 규칙 참고)
  business_reg_no_encrypted BYTEA NOT NULL,
  business_reg_no_digest    BYTEA NOT NULL,
  verification_status       VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending' | 'verified' | 'failed' (PROF-05)
  verified_at                TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_companies_business_reg_no_digest UNIQUE (business_reg_no_digest)
);
```
**설계 메모:** `business_reg_no_digest`의 유일 제약이 "이미 가입된 사업자등록번호로 재가입 시도"(01-onboarding.md 엣지 케이스)를 스키마 레벨에서 차단한다. `region_codes`를 배열로 둔 이유는 §복수성·병합 규칙 (a) 참고. `verification_status`는 PROF-05 진위확인 결과 상태만 저장하고 원문 응답은 보관하지 않는다(§민감정보 저장 규칙).

```sql
CREATE TABLE company_classification_codes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  classification_code  VARCHAR(8) NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, classification_code),
  CONSTRAINT chk_ccc_classification_code_length CHECK (length(classification_code) IN (2, 4, 6, 8)),
  CONSTRAINT chk_ccc_classification_code_numeric CHECK (classification_code ~ '^[0-9]+$')
);
```
**설계 메모:** D-06 조인 키의 물리 구현. `CHECK` 제약 2개가 §스파인이 강제하는 설계 제약 (a)를 DDL로 못 박는다. `UNIQUE (company_id, classification_code)`는 같은 업체가 같은 prefix를 중복 등록하는 것을 막는다.

```sql
CREATE TABLE company_performances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_name    VARCHAR(255) NOT NULL,
  contract_amount NUMERIC(15,0),
  contract_date   DATE,
  agency_name     VARCHAR(255),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
**설계 메모:** PROF-03 실적 등록 지원. 01-onboarding.md 스텝 4에 따라 전부 선택 입력(건너뛰기 가능)이라 `NOT NULL` 제약을 `project_name` 외에는 걸지 않는다.

```sql
CREATE TABLE company_certifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cert_type    VARCHAR(100) NOT NULL,
  cert_number  VARCHAR(100),
  expires_at   DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
**설계 메모:** PROF-04 인증 등록 지원. `cert_type`은 자유 텍스트로 시작하고(예: ISO9001, 벤처기업인증), 향후 정형 코드표가 필요해지면 별도 참조 테이블로 정규화한다 — 이번 Phase 범위 밖(D-05 취지와 동일하게 과설계 방지).

### 공고

```sql
CREATE TABLE bid_announcements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_bid_no       VARCHAR(50) NOT NULL,             -- 나라장터 공고번호
  source_revision_no  VARCHAR(10) NOT NULL DEFAULT '0', -- 개정 차수
  is_latest_revision  BOOLEAN NOT NULL DEFAULT true,    -- §복수성·병합 규칙 (b)
  title               TEXT NOT NULL,
  classification_code VARCHAR(8),                       -- 물품분류번호, NULL 허용 (§스파인이 강제하는 설계 제약 (c))
  region_codes        VARCHAR(10)[] NOT NULL DEFAULT '{}', -- 참가가능지역, 복수 (§복수성·병합 규칙 (a))
  agency_name         VARCHAR(255),
  budget_amount       NUMERIC(15,0),
  bid_open_at         TIMESTAMPTZ,
  bid_close_at        TIMESTAMPTZ,
  raw_payload         JSONB NOT NULL,                   -- 원문 API 응답 전체 보관 (재파싱 대비)
  fetched_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_bid_no, source_revision_no),
  CONSTRAINT chk_ba_classification_code_length
    CHECK (classification_code IS NULL OR length(classification_code) IN (2, 4, 6, 8)),
  CONSTRAINT chk_ba_classification_code_numeric
    CHECK (classification_code IS NULL OR classification_code ~ '^[0-9]+$')
);
```
**설계 메모:** ING-01~03 요구사항 지원. `raw_payload JSONB`는 파싱 로직이 바뀌어도 재처리 가능하게 하는 ingestion 표준 패턴이다(RESEARCH.md 설계 근거 메모). `UNIQUE (source_bid_no, source_revision_no)` + `is_latest_revision`은 §복수성·병합 규칙 (b)에서 고른 병합안이다.

### 매칭

```sql
CREATE TABLE matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES bid_announcements(id) ON DELETE CASCADE,
  score           NUMERIC(5,2) NOT NULL,
  matched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, announcement_id)
);
```
**설계 메모:** MATCH-01 지원. `UNIQUE (company_id, announcement_id)`는 같은 업체·같은 공고 조합의 매칭 행이 중복 생성되지 않게 한다 — 재스코어링 시에는 이 행을 UPSERT(`score` 갱신)한다.

### 알림

```sql
CREATE TABLE notification_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  channel       VARCHAR(20) NOT NULL,               -- 'email' | 'push'
  status        VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'sent' | 'failed'
  sent_at       TIMESTAMPTZ,
  error_message TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, channel)
);
```
**설계 메모:** MATCH-02·03 발송 이력. `UNIQUE (match_id, channel)`이 §스파인이 강제하는 설계 제약 (d)의 DDL 구현이다 — 재시도는 행 추가가 아니라 `status`·`sent_at`·`error_message` 갱신(UPDATE)으로 처리한다.

```sql
CREATE TABLE notification_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email_enabled             BOOLEAN NOT NULL DEFAULT true,
  push_enabled              BOOLEAN NOT NULL DEFAULT false,
  min_score_threshold       NUMERIC(5,2) NOT NULL DEFAULT 60.00,
  digest_frequency          VARCHAR(20) NOT NULL DEFAULT 'immediate', -- 'immediate' | 'daily_digest'
  quiet_hours_start         TIME,
  quiet_hours_end           TIME,
  deadline_reminder_enabled BOOLEAN NOT NULL DEFAULT true,
  deadline_reminder_days    SMALLINT NOT NULL DEFAULT 3,
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);
```
**설계 메모:** 업체별 알림 설정(1:1). 컬럼명은 `docs/design/wireframes/04-notification-settings.md` §데이터 소스 표의 잠정 제안을 그대로 채택했다 — 그 문서가 "이 문서(db-schema-design.md)가 존재하면 이쪽 컬럼명을 우선한다"고 명시했으므로, 이 스키마가 이제 그 화면 문서의 확정 근거가 된다.

이 8개 테이블 외의 테이블은 만들지 않는다 — 지역 복수성은 아래 §복수성·병합 규칙 (a)에서 배열 컬럼으로 결정해 별도의 `company_regions` 테이블을 추가하지 않는다.

## 인덱스와 조회 패턴

| 인덱스 | 대상 테이블·컬럼 | 조회 | 관련 요구사항 |
|---|---|---|---|
| `idx_bid_announcements_classification_code_pattern` | `bid_announcements.classification_code` (`varchar_pattern_ops`) | 업체가 등록한 prefix로 시작하는 공고 후보 조회(§스파인이 강제하는 설계 제약 (b) 권장안) | MATCH-01 |
| `idx_bid_announcements_bid_close_at` | `bid_announcements.bid_close_at` | 피드의 마감임박 정렬, 마감 지난 공고 기본 제외 | ING-04 |
| `idx_matches_company_id_matched_at` | `matches (company_id, matched_at DESC)` | 업체별 최신 매칭 조회 — 피드 첫 화면 로딩 | MATCH-01 |
| `uq_bid_announcements_source_bid_no_revision` | `bid_announcements (source_bid_no, source_revision_no)` (UNIQUE) | 공고 원본 식별자(공고번호·차수) 중복 수집 방지 | ING-03 |

```sql
CREATE INDEX idx_bid_announcements_classification_code_pattern
  ON bid_announcements (classification_code varchar_pattern_ops);

CREATE INDEX idx_bid_announcements_bid_close_at
  ON bid_announcements (bid_close_at);

CREATE INDEX idx_matches_company_id_matched_at
  ON matches (company_id, matched_at DESC);

CREATE UNIQUE INDEX uq_bid_announcements_source_bid_no_revision
  ON bid_announcements (source_bid_no, source_revision_no);
```

**경계:** 키워드 전문 검색(ING-04)은 PostgreSQL 자체 전문검색 인덱스를 직접 만들지 않고 `Meilisearch` 또는 `OpenSearch`에 위임한다(RESEARCH.md §Don't Hand-Roll). 이 문서는 검색엔진 인덱스 스키마를 설계하지 않는다.

## 복수성·병합 규칙

**(a) 지역의 복수성.** 1업체가 여러 활동 지역을 가질 수 있고(PROF-02), 1공고도 여러 참가가능지역을 가질 수 있다. 정규화 테이블(`company_regions` 별도 테이블)과 배열 컬럼(`region_codes VARCHAR(10)[]`) 두 방식을 비교한다 — 정규화 테이블은 지역별 조인·집계가 쉽지만 테이블·FK가 하나 늘고 단순 포함 여부 조회에는 과하다. 배열 컬럼은 테이블을 늘리지 않고 `= ANY(region_codes)` 또는 GIN 인덱스로 포함 조회가 가능하며, 지역이 "10~20개 시/도 중 소수 선택"이라는 낮은 카디널리티 특성상 정규화의 이점이 크지 않다. **우리는 배열 컬럼으로 한다** — `companies.region_codes`, `bid_announcements.region_codes` 둘 다 `VARCHAR(10)[]`. RESEARCH.md Assumptions Log A3가 이미 "복수 지역·복수 업종 반영 부족"을 경고했고, 이 결정이 그 부족을 메운다. 컬럼명·타입 자체는 CONTEXT.md Claude's Discretion 범위이므로 표준 관례(배열 + 향후 GIN 인덱스)로 결정했다.

**(b) 중복·개정 공고 병합(ING-03).** 나라장터가 같은 공고를 차수를 올려 재공고하는 경우를 병합할 키를 정한다. 두 안을 비교한다 — (i) `source_bid_no` 단독 유일 + 최신 차수로 UPSERT(개정 이력은 버림), (ii) `source_bid_no` + `source_revision_no` 복합 유일 + `is_latest_revision` 플래그(개정 이력 보존). **우리는 (ii)로 한다** — 개정 이력을 보존해야 03-detail.md의 "이 공고는 개정되었습니다 → 최신 공고 보기" 안내를 구현할 수 있고, 이미 발송된 알림이 가리키던 구 버전 공고를 지우지 않고 그대로 열람 가능하게 유지할 수 있다. 개정이 들어오면 이전 차수 행의 `is_latest_revision`을 `false`로 갱신하고 새 행을 추가한다 — 이때 구 버전을 가리키던 `matches` 행은 삭제하지 않고 그대로 둔다(사용자가 받은 알림 이력을 보존하기 위함이며, 최신 차수에 대한 새 매칭은 별도 행으로 추가된다).

**(c) 계정과 업체의 관계.** MVP는 **업체 1곳 = 계정 1개**로 시작한다 — 한 업체에 여러 담당자 계정을 두는 팀 기능은 이번 범위 밖이다. 나중에 팀 기능을 붙일 때는 `companies` 테이블에서 인증 주체(계정)를 분리해 `company_id`를 참조하는 별도 `accounts`(또는 `users`) 테이블이 필요해진다 — 지금은 `companies` 자체가 로그인 주체를 겸한다.

각 결정은 위와 같이 단정적으로 확정했다 — 확정하지 못한 부분(prefix 매칭 인덱스의 실측 성능, 개정 병합 규칙의 실데이터 검증)은 §Phase 2 인계 사항으로 명시적으로 위임한다.
