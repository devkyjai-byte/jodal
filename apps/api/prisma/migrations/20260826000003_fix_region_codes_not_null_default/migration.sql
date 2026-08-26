-- 02-02 Rule 1 버그 수정: 20260826000001_init이 companies.region_codes와
-- bid_announcements.region_codes에 db-schema-design.md §테이블 정의가 명시한
-- `NOT NULL DEFAULT '{}'`를 누락했다(schema.prisma에 @default([])가 없어
-- `prisma migrate diff --from-empty`가 nullable/무기본값 컬럼을 생성함).
-- AuthService.signup()이 companies 행을 생성할 때 regionCodes가 필수 필드로 요구되므로
-- 이 갭을 그대로 두면 이후 플랜(02-05 배치 수집 등)이 region_codes를 누락한 채
-- INSERT할 경우 NULL이 허용되어 매칭 쿼리(company.regionCodes.some(...))가
-- TypeError로 죽는다. 기존 NULL 행(있다면)을 먼저 '{}'로 채운 뒤 NOT NULL을 건다.

UPDATE "companies" SET "region_codes" = '{}' WHERE "region_codes" IS NULL;
ALTER TABLE "companies" ALTER COLUMN "region_codes" SET DEFAULT '{}';
ALTER TABLE "companies" ALTER COLUMN "region_codes" SET NOT NULL;

UPDATE "bid_announcements" SET "region_codes" = '{}' WHERE "region_codes" IS NULL;
ALTER TABLE "bid_announcements" ALTER COLUMN "region_codes" SET DEFAULT '{}';
ALTER TABLE "bid_announcements" ALTER COLUMN "region_codes" SET NOT NULL;
