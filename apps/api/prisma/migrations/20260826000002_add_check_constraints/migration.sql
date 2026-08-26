-- Prisma 스키마 언어는 CHECK 제약과 연산자 클래스(varchar_pattern_ops)를 표현하지 못한다.
-- `migrate dev --create-only` 워크플로우 대신 수동으로 빈 마이그레이션을 만들어 SQL을 추가한다
-- (02-RESEARCH.md Pattern 3, docs/design/db-schema-design.md §스파인이 강제하는 설계 제약 (a)/(b)).

-- CHECK 제약: company_classification_codes.classification_code
-- 자릿수 2/4/6/8만 허용, 숫자만 허용 (db-schema-design.md §테이블 정의)
ALTER TABLE "company_classification_codes"
  ADD CONSTRAINT "chk_ccc_classification_code_length" CHECK (length(classification_code) IN (2, 4, 6, 8)),
  ADD CONSTRAINT "chk_ccc_classification_code_numeric" CHECK (classification_code ~ '^[0-9]+$');

-- CHECK 제약: bid_announcements.classification_code
-- NULL 허용(§스파인이 강제하는 설계 제약 (c)) + 자릿수/숫자 제약은 값이 있을 때만 적용
ALTER TABLE "bid_announcements"
  ADD CONSTRAINT "chk_ba_classification_code_length"
    CHECK (classification_code IS NULL OR length(classification_code) IN (2, 4, 6, 8)),
  ADD CONSTRAINT "chk_ba_classification_code_numeric"
    CHECK (classification_code IS NULL OR classification_code ~ '^[0-9]+$');

-- idx_bid_announcements_classification_code_pattern은 최초 마이그레이션에서 일반 btree로
-- 생성되었다. db-schema-design.md §스파인이 강제하는 설계 제약 (b) 권장안(varchar_pattern_ops)에
-- 맞게 재생성한다 — 리터럴 prefix LIKE 조회(예: classification_code LIKE '43%')가
-- 인덱스 레인지 스캔을 타게 하려면 이 연산자 클래스가 필요하다.
DROP INDEX IF EXISTS "idx_bid_announcements_classification_code_pattern";

CREATE INDEX "idx_bid_announcements_classification_code_pattern"
  ON "bid_announcements" ("classification_code" varchar_pattern_ops);
