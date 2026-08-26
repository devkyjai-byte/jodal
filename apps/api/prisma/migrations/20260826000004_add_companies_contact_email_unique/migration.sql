-- 02-03 Rule 1/2 버그 수정: companies.contact_email이 POST /auth/login의 조회 키
-- (Prisma findUnique)로 쓰이는데, 원본 db-schema-design.md/20260826000001_init에는
-- NOT NULL만 있고 UNIQUE 제약이 없었다. UNIQUE 없이는 두 업체가 동일 이메일로 가입할 경우
-- 로그인 시 어느 계정을 인증해야 할지 특정할 수 없다(정확성·보안 문제).
-- 기존 행 중 이메일이 중복된 행이 있다면 이 마이그레이션이 실패하므로(예상 밖 데이터),
-- 실제 DB 적용 전 중복 여부를 먼저 확인해야 한다 — 이 실행 환경은 DB가 없어 오프라인으로
-- 스키마만 생성한다(WINDOWS.md unrun-verify 갭과 동일한 사유).

CREATE UNIQUE INDEX "companies_contact_email_key" ON "companies"("contact_email");
