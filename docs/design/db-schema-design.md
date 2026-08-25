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
