---
phase: 02-mvp
plan: 02
subsystem: auth
tags: [nestjs, passport-jwt, prisma, scrypt, aes-256-gcm, hmac-sha256, jwt, nextjs]

requires:
  - phase: 02-mvp (plan 01)
    provides: npm workspaces 모노레포, Prisma 7.10.0 9테이블 스키마, PrismaService/PrismaModule, 시드 픽스처 5건
provides:
  - "POST /auth/signup — 사업자등록번호 형식검증+AES-256-GCM 암호화+HMAC-SHA256 다이제스트, crypto.scrypt 비밀번호 해시, JWT 발급, 409 중복가입 차단"
  - "JwtStrategy/JwtAuthGuard — passport-jwt 기반 인증, 이후 모든 플랜(02-03~02-07)이 재사용"
  - "POST /companies/me/classification-codes (JWT 가드) — 등록 직후 동기 매칭 스코어링"
  - "MatchingService.scoreAndUpsert — scoreMatch/toQualitativeTier 스코어링 엔진, matches UPSERT"
  - "NotificationsService.sendMatchNotifications — 임계값 판정 + 이메일 발송 + notification_logs UPSERT, EmailSenderPort/ConsoleEmailAdapter"
  - "apps/web/signup 화면 — 회원가입 폼이 실제 백엔드에 연결됨"
affects: [02-03, 02-04, 02-05, 02-06, 02-07]

actuals:
  tokens: 13700
  tasks: 2
  commits: 2

tech-stack:
  added:
    - "jsonwebtoken 9.0.3 (+ @types/jsonwebtoken) — passport-jwt의 기존 전이 의존성을 명시적 직접 의존성으로 승격, JWT 서명에 사용"
    - "@types/passport-jwt, @types/passport — 컴파일에 필요했으나 02-RESEARCH.md 설치 목록에서 누락됨"
  patterns:
    - "사업자등록번호: AES-256-GCM(iv 12B + authTag 16B + ciphertext 단일 BYTEA) + HMAC-SHA256(pepper) 다이제스트 — apps/api/src/auth/crypto/business-reg-no.crypto.ts"
    - "비밀번호: crypto.scrypt(N=16384,r=8,p=1) — 저장 형식 `scrypt$N$r$p$saltHex$hashHex` — apps/api/src/auth/crypto/password.crypto.ts"
    - "포트/어댑터: EmailSenderPort 인터페이스 + ConsoleEmailAdapter(DI 토큰 EMAIL_SENDER_PORT) — 02-07이 어댑터만 ResendEmailAdapter로 교체"
    - "매칭 후보 조회: prefix 목록을 리터럴 OR절(Prisma startsWith)로 풀어 varchar_pattern_ops 인덱스 활용 (db-schema-design.md §(b) 권장안)"
    - "JwtStrategy를 AuthModule의 provider로만 등록하면 passport에 'jwt' 전략이 전역 등록되어 다른 모듈이 AuthModule을 import하지 않고도 JwtAuthGuard 사용 가능"

key-files:
  created:
    - apps/api/src/auth/crypto/business-reg-no.crypto.ts
    - apps/api/src/auth/crypto/password.crypto.ts
    - apps/api/src/auth/dto/signup.dto.ts
    - apps/api/src/auth/jwt.strategy.ts
    - apps/api/src/auth/jwt-auth.guard.ts
    - apps/api/src/auth/auth.service.ts
    - apps/api/src/auth/auth.controller.ts
    - apps/api/src/auth/auth.module.ts
    - apps/api/src/companies/dto/add-classification-code.dto.ts
    - apps/api/src/companies/companies.service.ts
    - apps/api/src/companies/classification-codes.controller.ts
    - apps/api/src/companies/companies.module.ts
    - apps/api/src/matching/matching.service.ts
    - apps/api/src/matching/matching.module.ts
    - apps/api/src/notifications/ports/email-sender.port.ts
    - apps/api/src/notifications/adapters/console-email.adapter.ts
    - apps/api/src/notifications/notifications.service.ts
    - apps/api/src/notifications/notifications.module.ts
    - apps/api/test/tracer.e2e-spec.ts
    - apps/api/prisma/migrations/20260826000003_fix_region_codes_not_null_default/migration.sql
    - apps/web/src/lib/api-client.ts
    - apps/web/src/app/signup/page.tsx
  modified:
    - apps/api/src/app.module.ts
    - apps/api/src/main.ts
    - apps/api/prisma/schema.prisma
    - apps/api/package.json

key-decisions:
  - "JWT 서명은 @nestjs/jwt를 새로 설치하지 않고 jsonwebtoken(이미 passport-jwt의 전이 의존성으로 resolve되어 있던 패키지, npm 레지스트리로 2013년/9M+ 주간 다운로드 재검증)을 직접 의존성으로 승격해 사용 — 02-RESEARCH.md 설치 목록에 없던 신규 최상위 패키지 추가를 피함"
  - "companies.region_codes/bid_announcements.region_codes에 NOT NULL DEFAULT '{}' 추가 (02-01의 마이그레이션 누락 수정) — db-schema-design.md가 명시한 제약을 실제로 강제"
  - "matches.score(원점수)는 API 응답에 노출하지 않고 컨트롤러 레벨에서 등급만 반환하도록 설계(현재는 id/classificationCode만 반환, 등급 변환은 02-03/02-04의 피드 응답에서 사용될 toQualitativeTier가 이미 존재)"

patterns-established:
  - "인증 필요 엔드포인트는 @UseGuards(JwtAuthGuard) + Request 확장 인터페이스(user: JwtPayload)로 companyId를 스코프한다"
  - "서비스 간 동기 체인(컨트롤러 -> CompaniesService -> MatchingService -> NotificationsService)은 02-05에서 BullMQ 워커로 그대로 옮겨질 수 있도록 각 서비스가 독립적으로 주입 가능하게 설계됨"

requirements-completed: [PROF-05, MATCH-01, CLIENT-01]

coverage:
  - id: D1
    description: "신규 업체가 사업자등록번호·업체명·이메일·비밀번호로 가입하면 계정이 즉시 생성되고 JWT가 발급된다"
    requirement: PROF-05
    verification:
      - kind: e2e
        ref: "apps/api/test/tracer.e2e-spec.ts#POST /auth/signup → 201 + JWT 발급"
        status: unknown
      - kind: other
        ref: "npm run build --workspace=apps/api (tsc), eslint --workspace=apps/api, live NestJS boot (app.e2e-spec.ts) — 전부 통과"
        status: pass
    human_judgment: true
    rationale: "이 실행 환경에 Docker/PostgreSQL이 없어(02-01-SUMMARY.md와 동일한 갭, WINDOWS.md #1/#3) tracer.e2e-spec.ts를 실제 DB에 대해 실행하지 못했다. 코드는 빌드·린트·DI 그래프 해석까지 통과했고 실행 시 오류는 ECONNREFUSED(DB 연결 실패)뿐이었다 — 사람이 Docker 설치 후 재현 절차로 1회 확인해야 한다."
  - id: D2
    description: "이미 등록된 사업자등록번호(다이제스트 기준)로 재가입을 시도하면 409로 거부된다"
    requirement: PROF-05
    verification:
      - kind: e2e
        ref: "apps/api/test/tracer.e2e-spec.ts#동일 사업자등록번호로 재가입 시도 → 409"
        status: unknown
    human_judgment: true
    rationale: "D1과 동일한 DB 미가용 사유. AuthService.signup()의 P2002 catch 분기는 코드 리뷰로 로직 검증됨(uq_companies_business_reg_no_digest UNIQUE 제약과 1:1 대응)."
  - id: D3
    description: "가입한 업체가 업종 분류코드를 1개 이상 등록하면, 그 prefix로 시작하는 시드 공고와 자동으로 매칭되어 matches 행이 생성된다"
    requirement: MATCH-01
    verification:
      - kind: e2e
        ref: "apps/api/test/tracer.e2e-spec.ts#DB에 matches 행이 생성되고 score > 0"
        status: unknown
    human_judgment: true
    rationale: "D1과 동일한 DB 미가용 사유. scoreMatch/toQualitativeTier는 02-RESEARCH.md 공식을 그대로 구현했고, 후보 조회 쿼리(리터럴 prefix OR절)는 코드 리뷰로 db-schema-design.md §(b) 권장안과 대조 검증했다."
  - id: D4
    description: "적합도 임계값(기본 60점) 이상 매칭에 대해 이메일 발송 기록이 notification_logs에 sent 상태로 정확히 1건만 남는다"
    verification:
      - kind: e2e
        ref: "apps/api/test/tracer.e2e-spec.ts#notification_logs에 channel='email', status='sent' 행이 정확히 1건 존재"
        status: unknown
    human_judgment: true
    rationale: "D1과 동일한 DB 미가용 사유."
  - id: D5
    description: "JWT 없이 보호된 프로필 엔드포인트를 호출하면 401이 반환된다"
    verification:
      - kind: e2e
        ref: "apps/api/test/tracer.e2e-spec.ts#JWT 없이 분류코드 등록 시도 → 401"
        status: pass
    human_judgment: false
  - id: D6
    description: "회원가입 화면이 POST /auth/signup에 실제로 연결되고, JWT를 로컬에 저장하며, 개인정보 동의 미체크 시 API 호출 없이 인라인 오류를 표시한다"
    requirement: CLIENT-01
    verification:
      - kind: automated_ui
        ref: "node fetch(http://localhost:3000/signup) — 폼 필드(사업자등록번호 등) 렌더링 확인, npm run build/lint --workspace=apps/web 통과"
        status: pass
    human_judgment: true
    rationale: "실제 백엔드(DB 포함) 없이는 제출→JWT 저장까지 브라우저에서 end-to-end 확인이 불가능했다. 클라이언트 검증 로직(동의 미체크 시 validate()가 signup() 호출 전에 조기 반환)은 코드 리뷰로 확인됨 — Docker 설치 후 사람이 실제 제출까지 1회 확인 필요."

duration: ~30min
completed: 2026-08-26
status: complete
---

# Phase 2 Plan 2: 회원가입·인증·매칭·알림 트레이서 Summary

**AES-256-GCM+HMAC-SHA256 사업자등록번호 암호화와 crypto.scrypt 비밀번호 해시로 실제 회원가입 API를 구현하고, RESEARCH.md 스코어링 공식을 그대로 구현한 MatchingService와 콘솔 어댑터 기반 NotificationsService로 가입→업종등록→매칭→알림기록 경로를 코드로 완성**

## Performance

- **Duration:** ~30분 (커밋 타임스탬프 기준 14:45→15:08, 이전 탐색·문서 읽기 포함 시 그 이상)
- **Started:** 2026-08-26T14:45:21+09:00 (워크트리 fork base 기준)
- **Completed:** 2026-08-26T15:08:06+09:00
- **Tasks:** 2 (tracer × 1, auto × 1)
- **Files modified:** 26 (신규 22, 수정 4)

## Accomplishments

- `AuthService.signup()` — 사업자등록번호 체크섬 검증(국세청 공개 알고리즘), AES-256-GCM 암호화(iv+authTag+ciphertext 단일 BYTEA)와 HMAC-SHA256(pepper) 다이제스트를 Node 내장 `crypto`만으로 구현(신규 암호화 패키지 설치 없음). `crypto.scrypt`(N=16384,r=8,p=1) 비밀번호 해시. `companies` + `notification_settings`를 Prisma 중첩 쓰기로 단일 트랜잭션 생성 후 JWT(jsonwebtoken, 24시간 만료) 발급. 다이제스트 UNIQUE 위반은 409로 변환.
- `JwtStrategy`/`JwtAuthGuard` — `passport-jwt` Bearer 토큰 검증(`JWT_SECRET`), payload는 `companyId`만 담음. `AuthModule`에 provider로만 등록해도 passport에 전역 등록되어 다른 모듈이 재사용 가능.
- `POST /companies/me/classification-codes`(JWT 가드) — 자릿수 검증(DTO + 기존 DB CHECK 제약) 후 행 생성, 동일 요청 내에서 `MatchingService.scoreAndUpsert(companyId)` 동기 호출.
- `MatchingService` — 02-RESEARCH.md의 `scoreMatch`(prefix 최대60·지역 최대25·실적/인증 최대15)와 `toQualitativeTier`(5단계) 공식을 그대로 구현. 후보 공고는 등록된 prefix 목록을 리터럴 `startsWith` OR절로 풀어 조회(db-schema-design.md §(b) 권장안 — 컬럼 대 컬럼 조인 회피). `matches`를 UPSERT하고, 새/갱신 매칭이 있으면 `NotificationsService.sendMatchNotifications`를 동기 호출.
- `NotificationsService` + `EmailSenderPort`/`ConsoleEmailAdapter` — `email_enabled && score >= min_score_threshold`이고 아직 이메일로 발송되지 않은 매칭만 골라 발송, `notification_logs`를 `(match_id, channel)` UNIQUE 기준 UPSERT(재시도 시 상태 갱신).
- `apps/web/src/app/signup/page.tsx` + `apps/web/src/lib/api-client.ts` — 01-onboarding.md 스텝 1 폼을 `POST /auth/signup`에 연결, 성공 시 JWT를 `localStorage`에 저장, 동의 미체크·형식 오류 시 API 호출 없이 인라인 오류 표시.
- Rule 1 버그 수정 — 02-01 마이그레이션이 `companies.region_codes`/`bid_announcements.region_codes`에 db-schema-design.md가 명시한 `NOT NULL DEFAULT '{}'`를 누락한 것을 발견해 새 마이그레이션으로 수정(`schema.prisma`에 `@default([])`도 추가).

## Task Commits

1. **Tracer: 회원가입 → 업종등록 → 매칭 → 알림기록 (백엔드)** - `c65a8dd` (feat)
2. **회원가입 화면 연결 (Next.js)** - `98949be` (feat)

**Plan metadata:** (이 커밋, 워크트리 모드 — STATE.md/ROADMAP.md는 오케스트레이터가 병합 후 갱신)

_두 태스크 모두 계획대로 `type="auto"`/`type="tracer"` 단일 커밋으로 완료(TDD 아님)._

## Files Created/Modified

- `apps/api/src/auth/crypto/business-reg-no.crypto.ts` — AES-256-GCM 암호화/복호화, HMAC-SHA256 다이제스트, 체크섬 검증
- `apps/api/src/auth/crypto/password.crypto.ts` — crypto.scrypt 해시/검증
- `apps/api/src/auth/{auth.service,auth.controller,auth.module,jwt.strategy,jwt-auth.guard}.ts` — 회원가입 API + JWT 인증
- `apps/api/src/auth/dto/signup.dto.ts` — class-validator DTO
- `apps/api/src/companies/{classification-codes.controller,companies.service,companies.module}.ts` — 분류코드 등록 + 매칭 트리거
- `apps/api/src/companies/dto/add-classification-code.dto.ts` — 자릿수/숫자 검증 DTO
- `apps/api/src/matching/{matching.service,matching.module}.ts` — 스코어링 엔진
- `apps/api/src/notifications/{notifications.service,notifications.module}.ts`, `ports/email-sender.port.ts`, `adapters/console-email.adapter.ts` — 알림 발송
- `apps/api/test/tracer.e2e-spec.ts` — 가입→매칭→알림 e2e 검증
- `apps/api/prisma/schema.prisma` — regionCodes `@default([])` 추가
- `apps/api/prisma/migrations/20260826000003_fix_region_codes_not_null_default/migration.sql` — 신규 마이그레이션
- `apps/api/src/app.module.ts` — AuthModule/CompaniesModule/MatchingModule/NotificationsModule 등록
- `apps/api/src/main.ts` — `app.enableCors()`, 전역 `ValidationPipe`
- `apps/api/package.json` — `jsonwebtoken`, `@types/jsonwebtoken`, `@types/passport-jwt`, `@types/passport` 추가
- `apps/web/src/lib/api-client.ts` — fetch 래퍼, signup(), accessToken localStorage 헬퍼
- `apps/web/src/app/signup/page.tsx` — 회원가입 폼

## Decisions Made

체크포인트 태스크 없음(이 플랜에는 `checkpoint:*` 태스크가 없음 — tracer 1개 + auto 1개). 아래 "Deviations from Plan"에 실행 중 내린 기술적 결정을 Rule별로 기록.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] JWT 서명 라이브러리 및 TypeScript 타입 정의 3종 추가**
- **Found during:** Task 1, `AuthService.signup()`의 JWT 발급 로직 작성 중
- **Issue:** 02-RESEARCH.md 설치 목록에는 `@nestjs/passport`+`passport`+`passport-jwt`만 있고 JWT를 실제로 서명(발급)할 라이브러리가 없었다(`passport-jwt`는 검증만 담당). `@types/jsonwebtoken`·`@types/passport-jwt`·`@types/passport`도 설치 목록에 없어 `tsc` 컴파일이 실패했다.
- **Fix:** 신규 최상위 패키지를 추가하는 대신, `passport-jwt`의 기존 전이 의존성으로 이미 `node_modules`에 resolve되어 있던 `jsonwebtoken`(npm 레지스트리로 2013년 최초 발행·9M+ 주간 다운로드 재검증)을 `apps/api/package.json`에 직접 의존성으로 승격해 사용. 타입 3종(`@types/jsonwebtoken`, `@types/passport-jwt`, `@types/passport`)도 모두 2016년 DefinitelyTyped 표준 패키지로 개별 재검증 후 devDependencies에 추가.
- **Files modified:** apps/api/package.json, package-lock.json, apps/api/src/auth/auth.service.ts
- **Verification:** `npm run build --workspace=apps/api` 통과
- **Committed in:** c65a8dd

**2. [Rule 1 - Bug] Buffer/Uint8Array 타입 불일치 (@types/node 24 + Prisma 7)**
- **Found during:** Task 1, 최초 빌드 시도
- **Issue:** `businessRegNoEncrypted`/`businessRegNoDigest`에 Node `Buffer`를 그대로 전달하면 Prisma의 `Bytes` 타입(`Uint8Array<ArrayBuffer>`)과 구조적으로 불일치(`Buffer<ArrayBufferLike>`가 `SharedArrayBuffer`도 포함하는 더 넓은 타입이라 TS가 거부)해 `tsc` 컴파일 실패.
- **Fix:** `Uint8Array.from(buffer)`로 감싸 전달(값은 동일, 타입만 좁힘).
- **Files modified:** apps/api/src/auth/auth.service.ts
- **Verification:** `npm run build --workspace=apps/api` 통과
- **Committed in:** c65a8dd

**3. [Rule 1 - Bug] EmailSenderPort 타입 임포트가 isolatedModules 위반**
- **Found during:** Task 1, 최초 빌드 시도
- **Issue:** `@Inject(EMAIL_SENDER_PORT)`로 데코레이트된 생성자 파라미터 타입에 인터페이스(`EmailSenderPort`)를 일반 import로 쓰면 `emitDecoratorMetadata`+`isolatedModules` 조합에서 TS1272 에러.
- **Fix:** `import type { EmailSenderPort }`로 분리.
- **Files modified:** apps/api/src/notifications/notifications.service.ts
- **Verification:** `npm run build --workspace=apps/api` 통과
- **Committed in:** c65a8dd

**4. [Rule 1 - Bug] `let company;`가 암묵적 `any`로 추론되어 eslint `no-unsafe-*` 위반**
- **Found during:** Task 1, `npm run lint` 실행
- **Issue:** try/catch 밖에서 초기화 없이 선언한 `let company;`가 암묵적 `any`로 추론되어, 이후 `company.id` 등 접근이 전부 `no-unsafe-member-access`/`no-unsafe-assignment` 위반.
- **Fix:** `let company: Company;`로 Prisma가 생성한 `Company` 타입 명시.
- **Files modified:** apps/api/src/auth/auth.service.ts
- **Verification:** `npm run lint --workspace=apps/api` 무오류
- **Committed in:** c65a8dd

**5. [Rule 1 - Bug] 02-01 마이그레이션이 `region_codes`에 `NOT NULL DEFAULT '{}'` 누락**
- **Found during:** Task 1, `AuthService.signup()`에서 `companies.create()` 호출 설계 중
- **Issue:** `schema.prisma`의 `Company.regionCodes`/`BidAnnouncement.regionCodes`에 `@default([])`가 없어 `20260826000001_init` 마이그레이션이 `region_codes VARCHAR(10)[]`를 NULL 허용·기본값 없음으로 생성했다 — db-schema-design.md §테이블 정의가 명시한 `NOT NULL DEFAULT '{}'`와 다르다. 방치하면 향후 플랜(02-05 배치 수집 등)이 `region_codes`를 누락한 채 INSERT할 경우 NULL이 그대로 저장되어, 매칭 로직의 `company.regionCodes.some(...)`가 런타임에 죽을 수 있다.
- **Fix:** `schema.prisma`에 `@default([])` 추가, `20260826000003_fix_region_codes_not_null_default` 마이그레이션으로 두 컬럼 모두 기존 NULL 행을 `'{}'`로 채운 뒤 `NOT NULL DEFAULT '{}'`를 건다. (02-01의 CHECK 제약 마이그레이션과 동일한 "Prisma 스키마 언어 한계 → raw SQL 보완" 패턴.)
- **Files modified:** apps/api/prisma/schema.prisma, apps/api/prisma/migrations/20260826000003_fix_region_codes_not_null_default/migration.sql
- **Verification:** `npx prisma validate` 통과, `npx prisma migrate diff --from-empty --to-schema` 오프라인 확인(DB 미가용으로 실제 `migrate deploy`는 미실행 — WINDOWS.md #1/#3과 동일 갭)
- **Committed in:** c65a8dd

**6. [Rule 2 - Missing Critical] 전역 ValidationPipe + CORS 추가**
- **Found during:** Task 1, `main.ts` 검토
- **Issue:** DTO에 `class-validator` 데코레이터를 작성해도 전역/컨트롤러 파이프가 없으면 NestJS가 검증을 실행하지 않는다(ASVS V5 Input Validation 미충족). 02-01의 `main.ts`에는 `app.enableCors()`도 없었다(플랜이 명시적으로 지시).
- **Fix:** `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))`와 `app.enableCors()`를 `main.ts`에 추가.
- **Files modified:** apps/api/src/main.ts
- **Verification:** `npm run build`, 실제 e2e 실행 시 JWT 없는 요청이 검증을 통과하기 전에 가드에서 401 반환 확인
- **Committed in:** c65a8dd

**7. [Rule 2 - Missing Critical] 서버 측 개인정보 동의 검증**
- **Found during:** Task 1, `AuthService.signup()` 작성 중
- **Issue:** 01-onboarding.md 엣지 케이스(동의 미체크 시 진행 차단)가 프론트엔드 전용으로 구현되면 API를 직접 호출하는 클라이언트는 동의 없이도 가입이 가능하다.
- **Fix:** `SignupDto.privacyConsent`를 `@IsBoolean()` 필수 필드로 받고, `AuthService.signup()`이 `false`면 `BadRequestException`을 던지도록 이중 방어선을 구성.
- **Files modified:** apps/api/src/auth/dto/signup.dto.ts, apps/api/src/auth/auth.service.ts
- **Verification:** 코드 리뷰(로직 검증) — 실DB 없이 e2e로 확인 불가(WINDOWS.md #3과 동일 갭)
- **Committed in:** c65a8dd

**8. [Rule 3 - Blocking] companies.module.ts / matching.module.ts / notifications.module.ts 및 DTO 파일 추가**
- **Found during:** Task 1, NestJS 모듈 배선
- **Issue:** 플랜의 `<files>` 목록에는 서비스/컨트롤러/크립토 파일만 있고 각 도메인의 `*.module.ts`, `signup.dto.ts`, `add-classification-code.dto.ts`가 없었다 — 이 파일들 없이는 NestJS DI 컨테이너가 컨트롤러·서비스를 와이어링할 수 없어 애플리케이션이 부팅되지 않는다.
- **Fix:** `AuthModule`/`CompaniesModule`/`MatchingModule`/`NotificationsModule`과 두 DTO 파일을 추가하고 `AppModule`에 등록.
- **Files modified:** apps/api/src/{auth,companies,matching,notifications}/*.module.ts, apps/api/src/{auth,companies}/dto/*.ts, apps/api/src/app.module.ts
- **Verification:** 실제 NestJS 앱 부팅(`app.e2e-spec.ts`)이 전체 DI 그래프를 오류 없이 해석함을 확인
- **Committed in:** c65a8dd

**9. [Deviation - Path convention] apps/web/app/signup → apps/web/src/app/signup**
- **Found during:** Task 2 시작 전 기존 구조 확인
- **Issue:** 플랜은 `apps/web/app/signup/page.tsx`, `apps/web/lib/api-client.ts`(src 없음)를 지정했으나, 02-01이 만든 실제 `create-next-app` 스캐폴딩은 `apps/web/src/app/*`, `tsconfig.json`의 `@/* -> ./src/*` 별칭을 쓴다.
- **Fix:** 기존 프로젝트 컨벤션을 따라 `apps/web/src/app/signup/page.tsx`, `apps/web/src/lib/api-client.ts`에 배치.
- **Files modified:** (경로만 다름, 내용은 계획대로)
- **Verification:** `npm run build --workspace=apps/web`이 `/signup` 라우트를 정상 생성
- **Committed in:** 98949be

---

**Total deviations:** 9 auto-fixed (1 Rule 3 패키지 추가, 3 Rule 1 컴파일 버그, 1 Rule 1 스키마 버그, 2 Rule 2 누락 보강, 1 Rule 3 배선 누락, 1 경로 컨벤션)
**Impact on plan:** 모두 정확성·보안·컴파일 가능성에 필수적인 수정이며 아키텍처 변경(Rule 4 대상)은 없었다. 패키지 추가(#1)는 신규 최상위 의존성을 늘리지 않고 이미 검증된 전이 의존성을 승격한 것으로 범위를 최소화했다.

## Tracer Feedback Gate

`type="tracer"` 태스크(Task 1) 완료 직후 `<verify>`(`npm run test:e2e --workspace=apps/api -- tracer.e2e-spec.ts`)를 재실행했다. 결과: **7개 중 1개 통과, 6개 실패 — 전부 `ECONNREFUSED`(DB 연결 실패) 또는 그 연쇄**(JWT 없는 요청 → 401 테스트는 DB 접근 전에 가드가 응답하므로 통과). 이는 02-01-SUMMARY.md가 이미 문서화한 것과 동일한 환경 갭(이 실행 환경에 Docker/PostgreSQL이 전혀 없음, WINDOWS.md #1)이며, `npm run build`/`eslint`/실제 NestJS 앱 부팅(`app.e2e-spec.ts`)은 전부 통과했다 — 즉 코드 로직 결함이 아니라 순수 인프라 부재로 판단해 **확장 태스크(Task 2)로 진행**했다. 이 판단은 02-01이 동일 갭을 이미 인간 확인 대기 항목으로 에스컬레이션했고 오케스트레이터가 그 상태로 Wave 2를 진행시켰다는 이 프로젝트의 기존 선례를 따른 것이다. WINDOWS.md #3으로 기록.

## Issues Encountered

**Docker/PostgreSQL이 이 실행 환경에 여전히 없음 (02-01과 동일)** — `docker`, `wsl`(설치된 배포판 없음) 모두 미탐지. 이로 인해 아래를 실DB 없이는 완료하지 못했다:

1. `tracer.e2e-spec.ts`의 6개 assertion(가입 201/409, 매칭 행 생성, 알림 로그 1건, 평문 컬럼 부재) — 전부 `ECONNREFUSED`.
2. 회원가입 화면의 "제출 → JWT 저장" 브라우저 end-to-end 확인 — 백엔드 DB 없이는 실제 가입 성공 응답을 받을 수 없어, `apps/web` 개발 서버를 띄워 `/signup` 페이지 렌더링(폼 필드 존재)까지만 확인했다.

`.planning/WINDOWS.md`에 `unrun-verify` 항목(entry #3)으로 기록했다 — `/gsd-ship` 이전에 사람이 02-01-SUMMARY.md의 재현 절차(Docker Desktop 설치 → `docker compose up -d` → `.env` 채우기 → `migrate deploy` → `db:seed`)를 실행한 뒤, 추가로 `npm run test:e2e --workspace=apps/api -- tracer.e2e-spec.ts`까지 통과하는지 확인해야 한다.

## User Setup Required

02-01-SUMMARY.md의 "User Setup Required"와 동일 — **Docker Desktop(Windows, WSL2 backend) 설치가 여전히 필요**합니다. 추가로:

1. 02-01 재현 절차 실행 후, `npm run test:e2e --workspace=apps/api -- tracer.e2e-spec.ts`가 7개 테스트 모두 통과하는지 확인
2. `apps/web`에서 `npm run dev` + `apps/api`에서 `npm run start:dev`를 동시에 띄운 뒤 브라우저로 `http://localhost:3000/signup`에서 실제 가입 제출 → `localStorage`에 `jodalmate_access_token` 키로 JWT가 저장되는지 확인 (개발자도구 Application 탭)

## Known Stubs

- `apps/web/src/app/signup/page.tsx`의 가입 성공 화면은 다음 온보딩 스텝(업종·지역 선택)으로 자동 이동하지 않고 정적 안내 문구만 표시한다 — 01-onboarding.md 스텝 2~5(업종/지역/실적·인증/알림설정)는 이 플랜 범위 밖(계획에 명시된 의도적 스코프, 스텝 1만 연결). 사업자등록번호 마스킹 재노출과 409 안내 화면 고도화는 02-03이 이어받는다(플랜 명시).
- 사업자등록번호 진위확인(국세청 API 연동, PROF-05의 나머지 절반)은 이 플랜 범위 밖 — `verification_status`는 02-01 스키마 그대로 `pending` 기본값에 머문다.

## Next Phase Readiness

- 인증(JWT 발급/검증)·매칭 스코어링·알림 발송의 핵심 로직이 실코드로 완성되어 02-03(로그인·프로필)·02-04(피드)·02-05(배치 수집)·02-06(검색)·02-07(알림 어댑터 교체)이 이 위에서 확장 가능
- **인계 사항 1 — 로그인 엔드포인트 없음**: `POST /auth/login`은 이 플랜 범위가 아니다(02-03이 구현). `password.crypto.ts`의 `verifyPassword`는 이미 준비되어 있다.
- **인계 사항 2 — matches 원점수 응답 미노출 확인 필요**: 현재 `classification-codes.controller.ts`는 생성된 분류코드 정보만 반환하고 매칭 결과 자체를 응답하지 않는다 — 02-04(피드) 구현 시 `toQualitativeTier()`를 사용해 등급만 노출해야 한다(Legal 제약, matching.service.ts에 함수는 이미 구현됨).
- **차단 사항 — Docker 설치 대기 (02-01부터 이어짐)**: 위 "User Setup Required" 참고. 사람이 Docker Desktop 설치 후 재현 절차를 실행해 WINDOWS.md #1과 #3(unrun-verify)을 모두 해소해야 Phase 2의 실질적 DB 통합 검증이 완료된다.

---
*Phase: 02-mvp*
*Plan: 02*
*Completed: 2026-08-26*

## Self-Check: PASSED

All key files verified present on disk, commit hashes verified in git log:
- `apps/api/src/auth/auth.service.ts` — FOUND
- `apps/api/src/matching/matching.service.ts` — FOUND
- `apps/api/src/notifications/notifications.service.ts` — FOUND
- `apps/api/test/tracer.e2e-spec.ts` — FOUND
- `apps/web/src/app/signup/page.tsx` — FOUND
- `apps/web/src/lib/api-client.ts` — FOUND
- `apps/api/prisma/migrations/20260826000003_fix_region_codes_not_null_default/migration.sql` — FOUND
- Commit `c65a8dd` — FOUND in `git log --oneline --all`
- Commit `98949be` — FOUND in `git log --oneline --all`
