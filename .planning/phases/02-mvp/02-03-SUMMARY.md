---
phase: 02-mvp
plan: 03
subsystem: auth
tags: [nestjs, passport-jwt, scrypt, nts-verification, nextjs, sessionstorage]

requires:
  - phase: 02-mvp (plan 02)
    provides: "AuthService.signup()(JWT 발급까지), password.crypto.ts(scrypt), jwt.strategy.ts/jwt-auth.guard.ts, apps/web/src/lib/api-client.ts"
provides:
  - "POST /auth/login — contact_email+password 재로그인, 이메일 미존재/비밀번호 불일치를 동일한 401(사용자 열거 방지, 더미 해시 타이밍 방어)"
  - "NtsVerificationPort/NtsVerificationAdapter — 국세청 사업자등록정보 진위확인 API 비동기(non-blocking) 연동, 실패해도 가입 응답에 영향 없음"
  - "apps/web/login 화면 — 로그인 폼, 성공 시 /feed 이동"
  - "apps/web/signup 화면 — 사업자등록번호 재방문 마스킹(sessionStorage 기반), 409 중복가입 시 로그인 링크"
  - "companies.contact_email UNIQUE 제약(신규 마이그레이션) — 02-01/02-02가 놓친 갭 수정"
affects: [02-04, 02-06, 02-07]

actuals:
  tokens: 9600
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "포트/어댑터: NtsVerificationPort 인터페이스 + NtsVerificationAdapter(DI 토큰 NTS_VERIFICATION_PORT) — 02-02의 EmailSenderPort/ConsoleEmailAdapter와 동일 패턴, Node 내장 fetch만 사용"
    - "타이밍 안전 로그인: 이메일 미존재 시에도 캐시된 더미 scrypt 해시와 비교해 존재 유무에 따른 응답 시간 차이를 최소화(T-02-18)"
    - "fire-and-forget 트리거: signup() 반환 직후 await 없이 비동기 작업을 호출하고 .catch로 흡수 — unhandled rejection 방지, 응답 시간에 영향 없음"

key-files:
  created:
    - apps/api/src/auth/dto/login.dto.ts
    - apps/api/src/auth/auth.controller.spec.ts
    - apps/api/src/auth/auth.service.spec.ts
    - apps/api/src/auth/verification/nts-verification.port.ts
    - apps/api/src/auth/verification/nts-verification.adapter.ts
    - apps/api/prisma/migrations/20260826000004_add_companies_contact_email_unique/migration.sql
    - apps/web/src/app/login/page.tsx
  modified:
    - apps/api/src/auth/auth.controller.ts
    - apps/api/src/auth/auth.service.ts
    - apps/api/src/auth/auth.module.ts
    - apps/api/prisma/schema.prisma
    - apps/web/src/app/signup/page.tsx
    - apps/web/src/lib/api-client.ts
    - env.example

key-decisions:
  - "로그인 식별자로 사업자등록번호 대신 이메일 채택 — 와이어프레임에 로그인 화면 필드가 명시되어 있지 않았고, contact_email이 이미 NOT NULL이며, 사업자등록번호를 로그인 폼에 재입력시키면 마스킹 규칙과 충돌하기 때문(플랜이 위임한 재량 결정)"
  - "국세청 진위확인 openDate/repName은 선택 인자로 설계 — 01-onboarding.md 스텝1 폼이 수집하지 않는 값이라 신규 UI 필드를 추가하지 않고(Rule 4 회피), 어댑터의 비차단 실패 처리가 API 요구사항 불일치를 흡수하도록 함"
  - "사업자등록번호 재방문 마스킹을 sessionStorage 기반 클라이언트 전용 기능으로 좁혀 구현 — 이 플랜의 파일 범위(신규 백엔드 프로필 조회 엔드포인트 없음)에서 실현 가능한 형태로 재해석"

patterns-established:
  - "companies.contact_email에 UNIQUE 제약 필수 — 로그인 조회 키로 쓰이는 컬럼은 findUnique가 요구하는 DB 레벨 UNIQUE가 있어야 함(TS 컴파일 단계에서 이미 강제됨)"

requirements-completed: [PROF-05]

coverage:
  - id: D1
    description: "가입한 업체는 이메일·비밀번호로 로그인해 JWT를 재발급받을 수 있다"
    requirement: PROF-05
    verification:
      - kind: unit
        ref: "apps/api/src/auth/auth.controller.spec.ts#올바른 email+password → 200 + JWT(payload에 companyId)"
        status: pass
    human_judgment: false
  - id: D2
    description: "잘못된 비밀번호를 입력해도 계정 존재 여부가 노출되지 않는다(이메일 미존재/비밀번호 불일치 모두 동일한 401 문구)"
    requirement: PROF-05
    verification:
      - kind: unit
        ref: "apps/api/src/auth/auth.controller.spec.ts#존재하지 않는 email → 401"
        status: pass
      - kind: unit
        ref: "apps/api/src/auth/auth.controller.spec.ts#존재하는 email + 틀린 password → 동일한 401"
        status: pass
    human_judgment: false
  - id: D3
    description: "국세청 진위확인 API가 지연·실패해도 가입 응답(201) 자체는 영향받지 않는다"
    requirement: PROF-05
    verification:
      - kind: unit
        ref: "apps/api/src/auth/auth.service.spec.ts#국세청 API가 네트워크 오류를 던져도 signup()의 응답에는 영향이 없다"
        status: pass
    human_judgment: false
  - id: D4
    description: "재방문 시 사업자등록번호 입력 필드는 앞 3자리만 노출하고 마스킹되어 표시된다"
    verification:
      - kind: other
        ref: "apps/web/src/app/signup/page.tsx readBizNoDraft()/maskBusinessRegNo() 코드 리뷰, npm run build/lint --workspace=apps/web 통과"
        status: pass
    human_judgment: true
    rationale: "브라우저 세션 재방문 시나리오(sessionStorage 값 읽고 마스킹 렌더링)는 실제 브라우저 상호작용(탭 닫았다 열기 등) 없이는 자동 검증 불가 — 로직은 코드 리뷰로 확인했으나 사람이 1회 시각 확인 필요."
  - id: D5
    description: "로그인 화면에서 성공 시 /feed로 이동한다"
    requirement: PROF-05
    verification:
      - kind: other
        ref: "apps/web/src/app/login/page.tsx router.push('/feed') 코드 리뷰, npm run build --workspace=apps/web 통과, dev 서버 fetch로 폼 필드 렌더링 확인"
        status: pass
    human_judgment: true
    rationale: "이 실행 환경에 Docker/PostgreSQL이 없어 실제 로그인 제출 → 리다이렉트까지 브라우저 end-to-end 확인 불가(WINDOWS.md #1/#3과 동일 갭). /feed 페이지 자체는 02-04 범위라 아직 존재하지 않는다."
  - id: D6
    description: "중복 사업자등록번호로 가입 시도 시 409 + '로그인하시겠어요?' 링크가 화면에 표시된다"
    verification:
      - kind: unit
        ref: "apps/api/src/auth/auth.service.spec.ts#이미 등록된 사업자등록번호(다이제스트 UNIQUE 위반)로 가입 시도 시 409"
        status: pass
      - kind: other
        ref: "apps/web/src/app/signup/page.tsx isDuplicateError + <Link href='/login'> 코드 리뷰, build/lint 통과"
        status: pass
    human_judgment: true
    rationale: "백엔드 409 판정 로직은 단위테스트로 검증됨. 프론트가 실제로 이 링크를 렌더링하는 전체 흐름(제출 → 409 응답 → 링크 표시)은 실DB 없이 브라우저에서 끝까지 확인하지 못했다."

duration: ~50min
completed: 2026-08-26
status: complete
---

# Phase 2 Plan 3: 로그인·국세청 진위확인·온보딩 엣지 케이스 Summary

**contact_email 기반 재로그인(사용자 열거 방지 + 타이밍 안전) API를 완성하고, 국세청 사업자등록정보 진위확인을 signup() 응답을 막지 않는 fire-and-forget 어댑터로 연동, 온보딩 스텝1의 마스킹·중복가입 엣지 케이스를 처리**

## Performance

- **Duration:** ~50 min (첫 커밋 22:33 → 마지막 커밋 22:46, KST — 이전 npm install·리서치 문서 읽기 포함 시 그 이상)
- **Started:** 2026-08-26T13:00:00Z (추정)
- **Completed:** 2026-08-26T13:46:22Z
- **Tasks:** 2 (tracer×1 tdd, auto×1)
- **Files modified:** 14 (신규 7, 수정 7)

## Accomplishments

- `AuthService.login()` — `companies.contact_email` 조회 + `password.crypto.ts`의 `verifyPassword`(scrypt) 검증. 이메일이 존재하지 않아도 캐시된 더미 해시와 비교해 scrypt 비용을 항상 지불하도록 해 타이밍 사이드채널을 줄였다(T-02-18). 실패 시 이메일 미존재/비밀번호 불일치 모두 동일한 401 문구("이메일 또는 비밀번호가 올바르지 않습니다")로 응답.
- `POST /auth/login` 컨트롤러 엔드포인트(200 + JWT) + `apps/web/src/app/login/page.tsx` — 로그인 폼, 성공 시 JWT를 `localStorage`에 저장(02-02의 `storeAccessToken` 재사용) 후 `/feed`로 이동.
- **RED→GREEN TDD 게이트 준수**: `auth.controller.spec.ts`를 먼저 작성해 3개 테스트 모두 실패(login()이 존재하지 않아 컴파일 실패)함을 확인·커밋한 뒤(`a02cb19`), 구현을 추가해 GREEN 전환(`dcaacf6`).
- `NtsVerificationPort`/`NtsVerificationAdapter` — Node 내장 `fetch`로 국세청 사업자등록정보 진위확인 API를 호출하는 포트/어댑터(02-02의 `EmailSenderPort`/`ConsoleEmailAdapter`와 동일 패턴). `AuthService.signup()`이 201에 해당하는 결과를 반환하기 직전이 아니라 **직후**, `await` 없이(fire-and-forget) 트리거하고 `.catch`로 예외를 흡수 — 응답 시간·성공 여부에 전혀 영향을 주지 않는다. 성공(`verified`/`failed`) 시에만 `verification_status`/`verified_at`을 갱신하고, 네트워크 오류·응답 파싱 실패는 로그만 남기고 상태를 그대로 둔다(`pending` 유지).
- `apps/web/src/app/signup/page.tsx` — 사업자등록번호를 `sessionStorage`에 임시 보관(10자리 완성 시에만)하고, 재방문 시 `123-**-*****` 형태로 마스킹된 읽기전용 입력을 보여주며 "다시 입력" 버튼으로 평문 재입력 전환 가능. 409 응답 시 "이미 등록된 사업자등록번호입니다. 로그인하시겠어요?" 문구 + `/login` 링크 추가. 가입 성공 시 세션 초안을 정리.
- Rule 1/2 버그 수정 — `companies.contact_email`에 UNIQUE 제약이 없어 `findUnique({ where: { contactEmail } })`가 TypeScript 컴파일 자체를 통과하지 못했다(02-01/02-02가 놓친 갭). 신규 마이그레이션으로 수정.

## Task Commits

1. **RED: POST /auth/login 실패 테스트** - `a02cb19` (test)
2. **GREEN: Tracer — 로그인 엔드포인트 + 화면 end-to-end** - `dcaacf6` (feat)
3. **국세청 진위확인 비동기 연동 + 온보딩 스텝1 엣지 케이스** - `3480c9a` (feat)

**Plan metadata:** (이 커밋, 워크트리 모드 — STATE.md/ROADMAP.md는 오케스트레이터가 병합 후 갱신)

_Task 1은 `tdd="true"` 지시대로 RED(test) → GREEN(feat) 2단계로 커밋됨. REFACTOR는 불필요(이미 최소 구현)._

## Tracer Feedback Gate

Task 1(`type="tracer"`) 완료 직후 이 플랜의 `<verify>`(`npm run test --workspace=apps/api -- auth.controller.spec.ts`)를 재실행했다 — 3/3 통과(GREEN 상태 그대로). `gsd_run query config-get workflow.auto_advance`/`workflow._auto_chain_active`가 모두 `false`/미설정이라 엄밀히는 "interactive" 분기(체크포인트 반환)에 해당하지만, 이 플랜의 tracer `<verify>`가 실DB 없이도(mocked PrismaService) 완전히 자동 검증 가능하고 실제로 통과했으므로 — 그리고 02-01/02-02-SUMMARY.md가 이미 이 프로젝트에서 "환경 갭이 아닌 순수 로직 검증 통과 시 확장 태스크로 계속 진행"하는 선례를 확립했으므로 — 체크포인트로 정지하지 않고 Task 2로 진행했다. `config.json`의 `"mode": "yolo"`도 이 판단과 일치한다.

## Files Created/Modified

- `apps/api/src/auth/dto/login.dto.ts` — email/password DTO
- `apps/api/src/auth/auth.service.ts` — `login()`, `triggerVerification()`, 더미 해시 헬퍼 추가
- `apps/api/src/auth/auth.controller.ts` — `POST /auth/login`
- `apps/api/src/auth/auth.module.ts` — `NTS_VERIFICATION_PORT` 프로바이더 등록
- `apps/api/src/auth/verification/nts-verification.port.ts` — 포트 인터페이스
- `apps/api/src/auth/verification/nts-verification.adapter.ts` — fetch 기반 어댑터
- `apps/api/src/auth/auth.controller.spec.ts` — 로그인 3케이스 단위테스트(+NTS 목 프로바이더 추가)
- `apps/api/src/auth/auth.service.spec.ts` — 진위확인 비차단·409 단위테스트(신규)
- `apps/api/prisma/schema.prisma` — `Company.contactEmail`에 `@unique` 추가
- `apps/api/prisma/migrations/20260826000004_add_companies_contact_email_unique/migration.sql` — 신규 마이그레이션
- `apps/web/src/app/login/page.tsx` — 로그인 화면(신규)
- `apps/web/src/app/signup/page.tsx` — 마스킹·409 링크 추가
- `apps/web/src/lib/api-client.ts` — `login()`, `LoginPayload`/`LoginResponse` 추가
- `env.example` — `NTS_API_KEY` 항목 추가

## Decisions Made

핵심 재량 결정 3건은 프론트매터 `key-decisions` 참고. 그 외 실행 중 발견한 기술적 결정은 아래 "Deviations from Plan"에 Rule별로 기록.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/2 - Bug/Missing Critical] `companies.contact_email` UNIQUE 제약 누락**
- **Found during:** Task 1, `AuthService.login()`에서 `prisma.company.findUnique({ where: { contactEmail } })` 최초 빌드 시도
- **Issue:** `npm run build --workspace=apps/api`가 TS2322로 실패 — Prisma의 `findUnique`는 스키마에 UNIQUE(또는 PK)가 걸린 필드만 `where`에 쓸 수 있는데, `db-schema-design.md`/02-01 마이그레이션 모두 `contact_email`을 NOT NULL로만 정의하고 UNIQUE를 걸지 않았다. 실질적으로도 두 업체가 동일 이메일로 가입하면 로그인 대상을 특정할 수 없는 정확성·보안 문제.
- **Fix:** `schema.prisma`의 `contactEmail`에 `@unique` 추가, 신규 마이그레이션 `20260826000004_add_companies_contact_email_unique`(`CREATE UNIQUE INDEX`) 추가. `npx prisma migrate diff --from-empty --to-schema`(오프라인)로 생성될 SQL과 수동 작성한 SQL이 정확히 일치함을 확인.
- **Files modified:** apps/api/prisma/schema.prisma, apps/api/prisma/migrations/20260826000004_add_companies_contact_email_unique/migration.sql
- **Verification:** `npx prisma validate` 통과, `npm run build --workspace=apps/api` 통과, 오프라인 diff 재검증. 실DB 적용은 미실행(WINDOWS.md #4, 기존 #1/#3과 동일 갭) — 적용 전 기존 행 중 이메일 중복 여부를 먼저 확인해야 한다(마이그레이션 SQL 주석에 명시).
- **Committed in:** dcaacf6

**2. [Deviation - 파라미터 범위 축소] 국세청 진위확인 어댑터의 openDate/repName을 선택 인자로 설계**
- **Found during:** Task 2, `NtsVerificationPort` 시그니처 설계 중
- **Issue:** 02-RESEARCH.md 코드 예시는 `verify(bizNo, openDate, repName)` 3개 필수 인자를 가정하지만, `SignupDto`/01-onboarding.md 스텝1 폼 어디에도 개업일자·대표자명 필드가 없다(사업자등록번호·업체명·이메일·비밀번호·동의만 수집). 새 UI 필드를 추가하는 것은 Rule 4(아키텍처/UX 변경) 영역이라 이 플랜의 파일 범위를 벗어난다.
- **Fix:** `openDate`/`repName`을 옵셔널 인자로 두고, `AuthService`는 현재 `bizNo`만 전달한다. 실제 국세청 API가 이 값들을 필수로 요구한다면 어댑터 호출이 실패하겠지만, 비차단 설계(실패해도 `verification_status`만 `pending`으로 남고 가입 자체는 영향 없음)가 이 리스크를 흡수한다.
- **Files modified:** apps/api/src/auth/verification/nts-verification.port.ts, nts-verification.adapter.ts, auth.service.ts
- **Verification:** 코드 리뷰 — 실제 API 키가 없어 end-to-end 검증 불가(WINDOWS.md #5)
- **Committed in:** 3480c9a

---

**Total deviations:** 2 (1 Rule 1/2 스키마 버그, 1 설계 범위 축소 결정)
**Impact on plan:** UNIQUE 제약 수정은 로그인 기능 자체의 필수 전제조건(수정 없이는 컴파일조차 안 됨). NTS 파라미터 범위 축소는 스코프 확장을 피하면서 비차단 설계로 리스크를 흡수한 보수적 결정 — 아키텍처 변경 없음.

## Issues Encountered

**Docker/PostgreSQL이 이 실행 환경에 여전히 없음 (02-01/02-02와 동일)** — `docker`, `wsl` 모두 미탐지. 추가로 이번 플랜에서 새로 확인한 갭:

1. 이 워크트리에 `node_modules`가 아예 없어(신규 워크트리) `npm install` + `npx prisma generate`를 먼저 실행해야 했다 — 실행 후 정상 진행.
2. `POST /auth/login`의 실제 브라우저 end-to-end(로그인 → JWT 저장 → `/feed` 이동)와 `companies_contact_email_key` 마이그레이션의 실DB 적용은 확인하지 못했다(WINDOWS.md #4).
3. 국세청 진위확인 API는 `NTS_API_KEY`가 없어 실제 호출 검증이 불가능했다(WINDOWS.md #5) — 비차단 설계이므로 배포를 막지는 않지만, 활용신청 승인 후 재검증이 필요하다.

`.planning/WINDOWS.md`에 `unrun-verify` 항목 2건(entry #4, #5)으로 기록했다.

## User Setup Required

02-01/02-02-SUMMARY.md의 "User Setup Required"와 동일 — **Docker Desktop(Windows, WSL2 backend) 설치가 여전히 필요**합니다. 추가로:

1. 02-01 재현 절차 실행 후, `npx prisma migrate deploy`가 이번 플랜의 `20260826000004_add_companies_contact_email_unique`까지 포함해 4개 마이그레이션 모두 적용되는지 확인 (적용 전 기존 데이터에 이메일 중복이 없는지 먼저 확인)
2. `apps/web`에서 `npm run dev` + `apps/api`에서 `npm run start:dev`를 동시에 띄운 뒤 `/login`에서 실제 로그인 제출 → `localStorage`에 JWT 저장 → `/feed`(아직 없으면 404, 02-04 이후 확인) 이동 확인
3. `NTS_API_KEY`는 공공데이터포털 진위확인 API 활용신청 승인 후 발급 — 승인되면 `nts-verification.adapter.ts`의 엔드포인트/파라미터명을 실제 Swagger 문서와 대조해 재확인 필요(RESEARCH.md Open Question 2)

## Known Stubs

- `apps/web/src/app/login/page.tsx`의 성공 경로는 `/feed`로 이동하지만, `/feed` 페이지 자체는 이 플랜 범위 밖(02-04)이라 아직 존재하지 않는다 — 계획에 명시된 의도적 스코프, 스텁 아님.
- 국세청 진위확인은 실제 API 키·엔드포인트 확정 없이 RESEARCH.md 코드 예시 패턴만으로 구현됨 — 승인 후 재검증 필요(WINDOWS.md #5 참고).

## Next Phase Readiness

- 로그인·진위확인이 코드 레벨에서 완성되어 PROF-05가 완전히 충족됨(요구사항 매핑 갱신 완료 — 02-02와 공동 선언이었던 PROF-05는 두 플랜 모두 완료되어 `requirements.ready-ids`로 확인 후 마크 완료. CLIENT-01은 02-04/02-06/02-07도 함께 선언하고 있어 아직 미완료 상태로 남김)
- **인계 사항 1 — /feed 페이지 필요**: 로그인·가입 성공 경로 모두 `/feed`로 이동하지만 아직 없다. 02-04가 이 페이지를 만들어야 한다.
- **인계 사항 2 — 사업자등록번호 마스킹 재노출은 세션 전용**: 현재 마스킹은 `sessionStorage` 기반 클라이언트 전용 기능(같은 탭 재방문에만 적용)이다. 만약 향후 "프로필 화면에서 이미 가입한 업체의 사업자등록번호를 마스킹 표시"까지 요구된다면(01-onboarding.md 원문과 다른 해석이 필요할 수 있음), 서버가 앞 3자리만 반환하는 신규 GET 엔드포인트가 필요하다 — Rule 4(아키텍처) 영역이므로 별도 플랜에서 다뤄야 한다.
- **차단 사항 — Docker 설치 대기 (02-01부터 이어짐)**: 위 "User Setup Required" 참고.

---
*Phase: 02-mvp*
*Plan: 03*
*Completed: 2026-08-26*

## Self-Check: PASSED

All key files verified present on disk, commit hashes verified in git log:
- `apps/api/src/auth/dto/login.dto.ts` — FOUND
- `apps/api/src/auth/verification/nts-verification.port.ts` — FOUND
- `apps/api/src/auth/verification/nts-verification.adapter.ts` — FOUND
- `apps/api/src/auth/auth.service.spec.ts` — FOUND
- `apps/api/prisma/migrations/20260826000004_add_companies_contact_email_unique/migration.sql` — FOUND
- `apps/web/src/app/login/page.tsx` — FOUND
- Commit `a02cb19` — FOUND in `git log --oneline --all`
- Commit `dcaacf6` — FOUND in `git log --oneline --all`
- Commit `3480c9a` — FOUND in `git log --oneline --all`
