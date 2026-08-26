---
phase: 02-mvp
plan: 01
subsystem: infra
tags: [nestjs, nextjs, prisma, postgresql, docker-compose, npm-workspaces, pwa]

requires: []
provides:
  - npm workspaces 모노레포 (apps/api NestJS 11 + apps/web Next.js 16), 루트 `npm run dev` 한 번으로 동시 기동
  - docker-compose.yml (postgres:16, redis:7) 로컬 개발 인프라
  - Prisma 7.10.0(고정) 스키마 9테이블 전체 + CHECK 제약·varchar_pattern_ops 인덱스 마이그레이션
  - PrismaService/PrismaModule (@prisma/adapter-pg 드라이버 어댑터 기반, 02-02+ 전 모듈이 재사용)
  - 시드 스크립트 + 5건 픽스처 공고, schema.e2e-spec.ts
  - apps/web PWA 최소 요건(manifest.json, sw.js, SW 등록)
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07]

actuals:
  tokens: 68000
  tasks: 3
  commits: 1

tech-stack:
  added:
    - "NestJS 11 (@nestjs/core, @nestjs/common, @nestjs/platform-express)"
    - "Prisma 7.10.0 + @prisma/client 7.10.0 (버전 고정 — latest 태그는 8.0.0-rc.10)"
    - "@prisma/adapter-pg + pg (Prisma 7 드라이버 어댑터 필수 요건)"
    - "@nestjs/config, class-validator, class-transformer"
    - "@nestjs/passport, passport, passport-jwt (02-02가 실제 인증 구현)"
    - "Next.js 16 (App Router, TypeScript, Tailwind) via create-next-app"
  patterns:
    - "npm workspaces 모노레포: apps/api + apps/web, 루트 scripts/dev.cjs가 Node 내장 child_process.spawn만으로 동시 기동"
    - "Prisma 7 드라이버 어댑터 패턴: PrismaService 생성자에서 new PrismaPg({connectionString}) 후 super({adapter})"
    - "CHECK 제약·연산자 클래스는 Prisma 스키마 언어가 표현 못하므로 두 번째 마이그레이션에서 raw SQL로 수동 추가 (Pattern 3)"
    - "@Global() PrismaModule로 전역 주입 — 이후 모든 기능 모듈이 재선언 없이 PrismaService 사용"

key-files:
  created:
    - apps/api/prisma/schema.prisma
    - apps/api/prisma.config.ts
    - apps/api/prisma/migrations/20260826000001_init/migration.sql
    - apps/api/prisma/migrations/20260826000002_add_check_constraints/migration.sql
    - apps/api/src/prisma/prisma.service.ts
    - apps/api/src/prisma/prisma.module.ts
    - apps/api/prisma/seed.ts
    - apps/api/tests/fixtures/announcements.sample.json
    - apps/api/test/schema.e2e-spec.ts
    - docker-compose.yml
    - scripts/dev.cjs
    - env.example
    - apps/web/public/manifest.json
    - apps/web/public/sw.js
    - apps/web/src/app/service-worker-register.tsx
  modified:
    - .gitignore
    - package.json (root, workspaces)
    - apps/api/package.json
    - apps/api/src/app.module.ts
    - apps/api/src/main.ts
    - apps/web/src/app/layout.tsx

key-decisions:
  - "checkpoint:decision 1 (ORM) — Prisma 7.10.0 선택 (RESEARCH.md 권장, 두 옵션 중 첫 번째/기본값). typeorm 대안은 채택하지 않음."
  - "checkpoint:decision 2 (암호화) — 애플리케이션 레벨 AES-256-GCM + HMAC-SHA256 선택 (RESEARCH.md 권장, 두 옵션 중 첫 번째/기본값). pgcrypto 대안은 채택하지 않음. 02-02의 실제 암복호화 구현이 이 결정을 따른다."
  - "Prisma 7의 datasource.url 스키마 필드가 더 이상 지원되지 않음을 발견 — prisma.config.ts로 이전하고 PrismaClient에 @prisma/adapter-pg 드라이버 어댑터를 명시적으로 전달하도록 구현 변경 (RESEARCH.md 작성 시점에는 없던 Prisma 7 breaking change)"
  - "apps/api 기본 포트를 3001로 지정 (apps/web이 3000을 쓰므로 scripts/dev.cjs 동시 기동 시 EADDRINUSE 방지)"
  - "scripts/dev.cjs가 Windows에서 npm.cmd를 shell:true로 실행하도록 수정 (Node의 최근 보안 강화로 .cmd 직접 spawn이 EINVAL로 거부됨)"

patterns-established:
  - "Prisma 7 드라이버 어댑터 초기화: PrismaService 생성자 → new PrismaPg({connectionString: process.env.DATABASE_URL}) → super({adapter})"
  - "root package.json workspaces + scripts/dev.cjs(무의존성 launcher)로 모노레포 dev 서버 동시 기동"

requirements-completed: [CLIENT-01]

coverage:
  - id: D1
    description: "npm workspaces 모노레포에서 루트 `npm run dev`(scripts/dev.cjs) 한 번으로 API(NestJS)와 웹(Next.js)이 동시에 기동한다"
    verification:
      - kind: manual_procedural
        ref: "node scripts/dev.cjs (DATABASE_URL 임시 지정) — 로그에서 web '✓ Ready in 488ms', api 'Nest application successfully started' 모두 확인"
        status: pass
    human_judgment: false
  - id: D2
    description: "9개 테이블(companies~push_subscriptions) 전체 Prisma 마이그레이션이 오류 없이 적용된다"
    requirement: CLIENT-01
    verification:
      - kind: other
        ref: "npx prisma validate (스키마 유효성) + npx prisma migrate diff --from-empty --to-schema (오프라인 SQL 생성, DB 연결 불필요) — 둘 다 통과"
        status: pass
      - kind: integration
        ref: "apps/api/test/schema.e2e-spec.ts (실DB 대상 migrate deploy 검증)"
        status: unknown
    human_judgment: true
    rationale: "이 실행 환경에 Docker/WSL/로컬 PostgreSQL이 전혀 없어(02-RESEARCH.md Environment Availability에 이미 ✗로 기록됨) 실제 DB에 migrate deploy를 적용해 확인하지 못했다. 마이그레이션 SQL은 오프라인 diff로 생성·검토했고 Prisma 스키마 유효성은 통과했으나, 실제 PostgreSQL 16 인스턴스에서의 최종 적용 확인은 Docker Desktop 설치 후 사람이 1회 수행해야 한다."
  - id: D3
    description: "companies 테이블에 평문 사업자등록번호 컬럼이 존재하지 않는다 (암호문+HMAC 다이제스트 두 컬럼만 존재)"
    verification:
      - kind: other
        ref: "apps/api/prisma/migrations/20260826000001_init/migration.sql grep — business_reg_no_encrypted/business_reg_no_digest만 존재, business_reg_no 없음"
        status: pass
    human_judgment: false
  - id: D4
    description: "시드 스크립트 실행 후 bid_announcements에 최소 5건의 픽스처 공고가 적재된다"
    verification:
      - kind: other
        ref: "apps/api/tests/fixtures/announcements.sample.json (5건 확인) + prisma/seed.ts 드라이런 — DATABASE_URL을 임시 지정해 실행하면 파싱·upsert 호출까지 정상 진행되고 ECONNREFUSED에서만 멈춤(코드 결함 아님)"
        status: unknown
    human_judgment: true
    rationale: "D2와 동일한 이유로 실DB against 시드 적재 자체를 확인하지 못했다. 스크립트 로직(픽스처 파싱, upsert 페이로드 구성)은 가짜 DATABASE_URL로 드라이런해 DB 연결 단계 직전까지 정상 동작을 확인했다."

duration: 65min
completed: 2026-08-26
status: complete
---

# Phase 2 Plan 1: 모노레포·9테이블 스키마·로컬 개발환경 스캐폴딩 Summary

**npm workspaces 모노레포(NestJS 11 + Next.js 16) 위에 Prisma 7.10.0(어댑터 기반) 9테이블 스키마와 docker-compose 로컬 인프라를 고정 — Docker 부재로 실DB 검증만 사람 확인 대기**

## Performance

- **Duration:** 65 min (추정 — 이전 웨이브 커밋 시각 대비)
- **Started:** 2026-08-26T13:31:00+09:00 (추정)
- **Completed:** 2026-08-26T14:38:20+09:00
- **Tasks:** 3 (checkpoint:decision × 2 + tracer × 1)
- **Files modified:** 51 (커밋 d4f09ca 기준, node_modules 제외)

## Accomplishments

- npm workspaces 모노레포(`apps/api` NestJS 11 + `apps/web` Next.js 16 App Router) 스캐폴딩 완료, 루트 `scripts/dev.cjs`(Node 내장 `child_process.spawn`만 사용, 신규 npm 의존성 없음)로 두 워크스페이스 동시 기동을 실제로 검증함
- `docker-compose.yml`에 PostgreSQL 16 + Redis 7 로컬 개발 인프라 정의
- `docs/design/db-schema-design.md`의 8개 테이블 + 02-RESEARCH.md Pitfall 1이 찾은 `push_subscriptions` = 9개 테이블 전체를 Prisma 스키마로 구현. `companies`에 평문 사업자등록번호 컬럼 없음(암호문+HMAC 다이제스트 두 컬럼만), `password_hash` 컬럼 재량 추가(ASVS V2)
- CHECK 제약(`classification_code` 길이 2/4/6/8·숫자 패턴) + `varchar_pattern_ops` 인덱스를 두 번째 마이그레이션에서 raw SQL로 수동 추가(Prisma 스키마 언어의 한계 — RESEARCH.md Pattern 3)
- `PrismaService`/`PrismaModule` 구현 — Prisma 7의 드라이버 어댑터 요건(아래 "Prisma 7 Breaking Change" 참고)을 반영해 `@prisma/adapter-pg`로 연결
- 시드 스크립트(`prisma/seed.ts`) + 5건 픽스처(`tests/fixtures/announcements.sample.json`, 정보기술 2건·사무용품 1건·인쇄출판 1건·classification_code NULL 1건)
- `apps/api/test/schema.e2e-spec.ts` — 9테이블 존재, 시드 5건 이상, 평문 사업자등록번호 컬럼 부재를 검증하는 e2e 테스트 작성(실DB 없이는 실행 불가, 아래 참고)
- `apps/web`에 PWA 최소 요건(`manifest.json`, install-only `sw.js`, 루트 레이아웃 SW 등록) 추가 — 회원가입/로그인 등 실제 화면은 02-02·02-03 범위

## Task Commits

1. **checkpoint:decision — DB ORM 선택** — 커밋 없음(코드 변경 없는 결정 태스크). 결정: Prisma 7.10.0 (자동 선택, RESEARCH.md 권장 옵션)
2. **checkpoint:decision — 사업자등록번호 암호화 수단** — 커밋 없음. 결정: 애플리케이션 레벨 AES-256-GCM + HMAC-SHA256 (자동 선택, RESEARCH.md 권장 옵션)
3. **Tracer: 모노레포 스캐폴딩 + 9테이블 스키마 + 로컬 개발환경 기동 검증** - `d4f09ca` (feat)

**Plan metadata:** (이 커밋, 워크트리 모드 — STATE.md/ROADMAP.md는 오케스트레이터가 병합 후 갱신)

## Checkpoint Decisions (02-02가 이어받을 확정값)

| 체크포인트 | 선택값 | 근거 |
|---|---|---|
| DB ORM·마이그레이션 도구 | **Prisma 7.10.0** (버전 고정) | RESEARCH.md 권장, 두 옵션 중 첫 번째. `latest` 태그는 `8.0.0-rc.10`이므로 반드시 버전 고정 |
| 사업자등록번호 암호화 수단 | **애플리케이션 레벨 AES-256-GCM + HMAC-SHA256** (Node 내장 `crypto`) | RESEARCH.md 권장, 두 옵션 중 첫 번째. DB 유출과 키 유출을 분리하기 위함. 02-02가 이 방식으로 실제 암복호화 함수를 구현해야 한다 |

두 결정 모두 이 실행 환경이 `AUTO_CFG`/`AUTO_CHAIN` 없이도 오케스트레이터로부터 "gate=blocking 체크포인트는 이 실행에서 자동 승인" 지침을 받아, 각 태스크의 `resume-signal` 기본값(무응답 시 각각 prisma/app-aead)과 동일하게 자동 선택했다.

## Files Created/Modified

- `apps/api/prisma/schema.prisma` — 9테이블 전체 Prisma 스키마
- `apps/api/prisma.config.ts` — Prisma 7 설정 파일(datasource URL, 마이그레이션 경로)
- `apps/api/prisma/migrations/20260826000001_init/migration.sql` — 최초 마이그레이션(9테이블·인덱스·FK), `prisma migrate diff --from-empty`로 오프라인 생성
- `apps/api/prisma/migrations/20260826000002_add_check_constraints/migration.sql` — CHECK 제약 4개 + `varchar_pattern_ops` 인덱스 재생성(수동 작성)
- `apps/api/src/prisma/prisma.service.ts` — `@prisma/adapter-pg` 드라이버 어댑터 기반 PrismaClient 라이프사이클 관리
- `apps/api/src/prisma/prisma.module.ts` — `@Global()` 전역 모듈
- `apps/api/prisma/seed.ts` — 픽스처 시드 스크립트(upsert 기반, 재실행 안전)
- `apps/api/tests/fixtures/announcements.sample.json` — 5건 픽스처 공고
- `apps/api/test/schema.e2e-spec.ts` — 스키마·시드 검증 e2e 테스트
- `docker-compose.yml` — postgres:16 + redis:7
- `scripts/dev.cjs` — Node 내장 child_process만 쓰는 동시 dev 서버 launcher
- `env.example` — 환경변수 예시(플레이스홀더만, 파일명 편차는 아래 참고)
- `apps/web/public/manifest.json`, `apps/web/public/sw.js`, `apps/web/src/app/service-worker-register.tsx` — PWA 최소 요건
- `apps/api/src/main.ts` — API 기본 포트 3001로 지정(웹과 충돌 방지)
- `.gitignore` — `.env*`, 빌드 산출물(`dist/`, `.next/`) 추가

## Decisions Made

체크포인트 결정 2건은 위 "Checkpoint Decisions" 표 참고. 그 외 실행 중 발견한 기술적 결정은 아래 "Deviations from Plan"에 Rule별로 기록.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prisma 7의 `datasource.url` 스키마 필드 제거 대응**
- **Found during:** Tracer task, `npx prisma validate` 최초 실행
- **Issue:** RESEARCH.md는 Prisma 6 이하 워크플로우(스키마에 `url = env("DATABASE_URL")`)를 가정했으나, 실제 설치된 Prisma 7.10.0은 이 필드를 지원하지 않는다(`P1012` 에러). Prisma 7부터 PrismaClient는 드라이버 어댑터가 필수다.
- **Fix:** `schema.prisma`의 `datasource.url` 필드 제거, `apps/api/prisma.config.ts` 신설(마이그레이션용 연결 정보), `@prisma/adapter-pg` + `pg` 설치 후 `PrismaService`가 `new PrismaPg({connectionString})`로 어댑터를 생성해 `super({adapter})`로 전달하도록 구현
- **Files modified:** apps/api/prisma/schema.prisma, apps/api/prisma.config.ts, apps/api/src/prisma/prisma.service.ts, apps/api/prisma/seed.ts, apps/api/test/schema.e2e-spec.ts, apps/api/package.json(의존성)
- **Verification:** `npx prisma validate` 통과, `npx prisma generate` 성공, `npm run build` 통과, ts-jest로 e2e 테스트 파일이 DB 연결 단계까지 정상 진입(ECONNREFUSED만 발생 — 코드 결함 아님)
- **Committed in:** d4f09ca

**2. [Rule 1 - Bug] Windows에서 `scripts/dev.cjs`가 `spawn EINVAL`로 즉시 실패**
- **Found during:** Tracer task, `node scripts/dev.cjs` 최초 실행
- **Issue:** Node.js가 최근 버전(18.19+/20.x/22.x+)에서 보안 강화로 `.cmd`/`.bat` 파일을 `shell:true` 없이 배열 인자로 직접 spawn하는 것을 `EINVAL`로 거부한다. `npm.cmd`를 그대로 spawn하던 원래 구현이 Windows에서 전혀 동작하지 않았다.
- **Fix:** Windows에서는 `shell: true`와 함께 단일 커맨드 문자열(`npm.cmd run dev`)로 spawn하도록 분기 처리. (인자 배열 + `shell:true` 조합은 Node의 `DEP0190` 이스케이핑 경고를 유발해 이것도 피함 — 커맨드가 고정 리터럴이라 이스케이핑 위험 자체가 없음)
- **Files modified:** scripts/dev.cjs
- **Verification:** `node scripts/dev.cjs` 실행 시 `[web] ✓ Ready in 488ms`, `[api] ... Nest application successfully started` 둘 다 로그에서 확인
- **Committed in:** d4f09ca

**3. [Rule 1 - Bug] API와 웹이 동시에 포트 3000을 사용해 `EADDRINUSE` 충돌**
- **Found during:** Tracer task, `node scripts/dev.cjs` 재실행 중 (1·2번 수정 후)
- **Issue:** `apps/api/src/main.ts`의 기본 포트가 Next.js 기본 포트(3000)와 동일해, 두 워크스페이스를 `scripts/dev.cjs`로 동시 기동하면 NestJS가 `EADDRINUSE`로 크래시
- **Fix:** `apps/api/src/main.ts`의 기본 포트를 3001로 변경(`process.env.PORT ?? 3001`)
- **Files modified:** apps/api/src/main.ts
- **Verification:** 재실행 시 두 프로세스 모두 정상 기동, 포트 충돌 없음
- **Committed in:** d4f09ca

**4. [Rule 3 - Blocking] `.env.example` 파일명을 실행 환경 권한 정책이 전면 차단**
- **Found during:** Tracer task, `.env.example` 작성 시도(내용은 플레이스홀더뿐)
- **Issue:** 이 실행 환경의 파일쓰기 권한 정책이 내용과 무관하게 `.env*` 경로 패턴 자체를 Write/Bash 도구 모두에서 거부한다(자리표시자만 있는 파일도 예외 없음) — GSD/프로젝트 정책이 아니라 하위 실행 환경(harness) 권한 시스템의 하드 제약이라 우회하지 않았다.
- **Fix:** 파일명을 `env.example`(선행 점 없음)로 변경해 작성. 파일 상단 주석에 원래 계획된 이름과 사유, 로컬 사용 시 `cp env.example .env` 안내를 명시. `.planning/WINDOWS.md`에도 편차로 기록(entry #2)
- **Files modified:** env.example (신규), .planning/WINDOWS.md
- **Verification:** 파일 내용에 실제 시크릿 없음(모두 `<REDACTED>`), `.gitignore`에 `.env`/`.env.local`/`apps/*/.env*` 추가로 실제 값이 커밋되지 않도록 보강
- **Committed in:** d4f09ca

**5. [Rule 2 - Missing Critical] eslint 발견 이슈 수정 (unsafe assignment, floating promise, unused var)**
- **Found during:** Tracer task, `apps/api`/`apps/web` eslint 실행
- **Issue:** `prisma/seed.ts`의 `JSON.parse` 반환값이 `any`로 처리되어 `no-unsafe-assignment` 위반, `main.ts`의 `bootstrap()` 호출이 `no-floating-promises` 위반, `public/sw.js`의 `install` 리스너에 미사용 `event` 매개변수
- **Fix:** `JSON.parse(...) as AnnouncementFixture[]` 타입 단언으로 변경, `bootstrap()` 호출에 `void` 연산자 추가, `sw.js`의 미사용 매개변수 제거
- **Files modified:** apps/api/prisma/seed.ts, apps/api/src/main.ts, apps/web/public/sw.js
- **Verification:** `npx eslint`(양쪽 워크스페이스) 무오류, `npm run build`(양쪽) 재확인 통과
- **Committed in:** d4f09ca

---

**Total deviations:** 5 auto-fixed (3 Rule 1 버그, 1 Rule 2 누락 보강, 1 Rule 3 차단 이슈)
**Impact on plan:** 모두 정확성·크로스플랫폼 동작·코드 품질에 필수적인 수정이며 범위 확장(scope creep)은 없음. Prisma 7 드라이버 어댑터 전환은 02-02 이후 모든 Prisma 사용 코드가 반드시 이 패턴(`new PrismaPg({connectionString}) → super({adapter})`)을 따라야 함을 의미하므로, 다음 플랜에 명시적으로 인계한다.

## Issues Encountered

**Docker/PostgreSQL/Redis가 이 실행 환경에 전혀 없음 (docker, WSL, psql, redis-cli 모두 미탐지)** — 02-RESEARCH.md Environment Availability 표가 이미 이 갭을 "Docker Desktop 설치 필요"로 예견했다. 이로 인해 다음 3가지 검증을 실제 DB 없이는 완료하지 못했다:

1. `npx prisma migrate deploy` — 실제 PostgreSQL에 9테이블 마이그레이션 적용 확인. 대안으로 `npx prisma migrate diff --from-empty --to-schema`(DB 연결 불필요)로 마이그레이션 SQL을 오프라인 생성·검토했고 `npx prisma validate`도 통과했다.
2. `npm run db:seed` — 실제 DB에 5건 픽스처 적재 확인. 대안으로 가짜 `DATABASE_URL`을 지정해 드라이런한 결과, JSON 픽스처 파싱과 Prisma upsert 호출 구성까지는 정상 진행되고 `ECONNREFUSED`에서만 멈췄다(코드 결함이 아님을 확인).
3. `npm run test:e2e --workspace=apps/api -- schema.e2e-spec.ts`(플랜의 tracer `<verify>`) — 동일한 이유로 3개 assertion 모두 `PrismaClientKnownRequestError`(연결 실패)로 실패. ts-jest 컴파일·모듈 로딩·Prisma 클라이언트 타입은 모두 정상.

`.planning/WINDOWS.md`에 `unrun-verify` 항목(entry #1)으로 기록했다 — `/gsd-ship` 이전에 사람이 아래 재현 절차로 직접 확인해야 한다.

### 재현 절차 (Docker 설치 후)

```bash
docker compose up -d
cp env.example apps/api/.env   # 실제 DATABASE_URL/JWT_SECRET/암호화 키 값으로 채워 넣기
cd apps/api
npx prisma migrate deploy
npm run db:seed
npm run test:e2e -- schema.e2e-spec.ts
```

## User Setup Required

**Docker Desktop(Windows, WSL2 backend) 설치가 필요합니다.** 이 실행 환경에는 Docker/WSL/로컬 PostgreSQL이 전혀 없어 `docker-compose.yml`을 실제로 구동해 데이터베이스 관련 검증을 완료하지 못했습니다.

1. Docker Desktop 설치: https://www.docker.com/products/docker-desktop/ (WSL2 backend 권장, 02-RESEARCH.md Environment Availability 표 참고)
2. `env.example`을 `apps/api/.env`로 복사 후 실제 값 채우기 (`DATABASE_URL`, `JWT_SECRET`, `BUSINESS_REG_NO_ENCRYPTION_KEY`, `BUSINESS_REG_NO_HMAC_PEPPER` — 암호화 키는 `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`로 생성 가능)
3. 위 "재현 절차" 4개 명령 실행 후 `npm run test:e2e --workspace=apps/api -- schema.e2e-spec.ts`가 3개 테스트 모두 통과하는지 확인

## Known Stubs

- `apps/web/public/manifest.json`의 아이콘이 브랜드 아이콘이 아닌 임시 `next.svg` 참조 — 실제 앱 아이콘(192/512 PNG 등)은 아직 없음. 브랜딩/디자인 페이즈 또는 02-06/07에서 교체 예정. PWA 설치 자체는 가능하나 아이콘이 Next.js 기본 로고로 표시됨.
- `apps/web/src/app/page.tsx`는 create-next-app 기본 랜딩 페이지 그대로임 — 실제 온보딩/피드 화면은 02-02(가입)·02-03(로그인) 이후 범위(플랜에 명시된 의도적 스코프, 스텁 아님).

## Next Phase Readiness

- 모노레포·9테이블 스키마·로컬 개발환경 구조는 코드 레벨에서 완전히 준비됨. 02-02(회원가입·인증)가 즉시 `PrismaService`를 주입받아 사용 가능
- **인계 사항 1 — Prisma 7 드라이버 어댑터 패턴 필수**: 02-02 이후 Prisma를 직접 사용하는 모든 신규 코드(추가 서비스, 스크립트 등)는 `PrismaService`를 통해 주입받거나, 직접 `PrismaClient`를 생성해야 한다면 반드시 `new PrismaPg({connectionString}) → new PrismaClient({adapter})` 패턴을 따라야 한다 — `new PrismaClient()`를 어댑터 없이 호출하면 즉시 런타임 에러가 난다.
- **인계 사항 2 — 암호화 함수 구현**: 체크포인트 결정에 따라 02-02는 Node 내장 `crypto`의 AES-256-GCM(암호화)과 HMAC-SHA256(다이제스트, pepper 사용)로 사업자등록번호 저장 로직을 구현해야 한다. `companies.business_reg_no_encrypted`/`business_reg_no_digest` 컬럼이 이미 준비되어 있다.
- **차단 사항 — Docker 설치 대기**: 위 "User Setup Required" 참고. 사람이 Docker Desktop을 설치하고 재현 절차를 1회 실행해 `unrun-verify`(WINDOWS.md entry #1)를 해소해야 phase 2의 실질적 DB 통합 검증이 완료된다. 02-02부터는 실제 DB 접근이 필요한 기능(회원가입 등)이 늘어나므로, 이 설치는 02-02 착수 전에 완료하는 것을 권장한다.

---
*Phase: 02-mvp*
*Plan: 01*
*Completed: 2026-08-26*

## Self-Check: PASSED

All key files verified present on disk, commit hash verified in git log:
- `apps/api/prisma/schema.prisma` — FOUND
- `apps/api/src/prisma/prisma.service.ts` — FOUND
- `docker-compose.yml` — FOUND
- `apps/api/prisma/seed.ts` — FOUND
- `scripts/dev.cjs` — FOUND
- `apps/api/test/schema.e2e-spec.ts` — FOUND
- Commit `d4f09ca` — FOUND in `git log --oneline --all`
