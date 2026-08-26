# Phase 2: MVP — 맞춤 매칭·알림 - Research

**Researched:** 2026-08-26
**Domain:** NestJS 백엔드 + PostgreSQL/Prisma + Meilisearch 검색 + Redis/BullMQ 배치·알림 파이프라인 + 나라장터 Open API 연동 + 사업자등록번호 진위확인
**Confidence:** MEDIUM — 프레임워크·라이브러리 선택은 공식 문서·npm 레지스트리로 교차검증됨(HIGH에 가까움). 나라장터 API의 정확한 필드명·트래픽 한도·물품분류 세부코드, 그리고 MATCH-01 스코어링 수식은 이번 세션에서 실측 데이터 없이 설계한 제안이라 LOW-MEDIUM.

## Summary

Phase 1이 남긴 9개 미결정 사항 중 다수는 사실 이미 반쯤 결정되어 있었다 — `docs/design/db-schema-design.md`가 prefix 매칭 인덱스 전략, 지역 복수성, 공고 개정 병합 규칙을 이미 근거와 함께 확정했고, 이번 세션은 그 결정을 PostgreSQL 공식 메일링리스트로 재검증했을 뿐이다(모두 맞는 결정이었다). 진짜 새로 결정해야 했던 것은 백엔드 프레임워크, ORM, 검색엔진, 알림 발송 메커니즘, 스코어링 수식, 사업자등록번호 인증 경로였다.

**가장 결정적인 발견은 백엔드 선택이 이미 PROJECT.md 제약조건 자체에 의해 사실상 결정되어 있었다는 것이다.** `PROJECT.md`는 "Redis+BullMQ(큐·스케줄러)"를 이미 확정 스택으로 명시한다. BullMQ는 Node.js 전용 라이브러리다(Python에서 쓸 수 없다) — 따라서 FastAPI(Python)를 택하면 큐·스케줄러만 별도의 Node.js 프로세스로 분리 운영해야 하고, 이는 "1인 개발, 러닝커브·운영부담이 적은 조합 우선"이라는 CLAUDE.md 제약과 정면으로 충돌한다. **NestJS(TypeScript)로 백엔드를 통일하는 것이 유일하게 정합적인 선택이다.**

검색엔진은 Meilisearch를 권장한다 — 단일 바이너리, JVM 없음, 설정 없이 즉시 구동 가능해 1인 운영 부담이 OpenSearch보다 현저히 낮다(OpenSearch는 JVM 힙 튜닝·샤드 관리가 필요한 Elasticsearch 계열 복잡도를 그대로 물려받는다). ORM은 Prisma를 권장하되, **`npm install prisma`의 `latest` 태그가 현재 `8.0.0-rc.10`(릴리스 후보)을 가리키므로 반드시 안정 버전(`7.10.0`, `prev` 태그)을 명시적으로 고정 설치해야 한다** — 이번 세션에서 직접 확인한 사실이며, 무심코 최신 태그를 설치하면 RC 빌드가 프로덕션에 들어간다.

MATCH-01 스코어링은 이번 문서가 처음으로 구체적 수식을 제안한다: 분류코드 prefix 일치 자릿수(최대 60점) + 지역 일치(최대 25점) + 실적/인증 보조 신호(최대 15점) = 100점 만점, 5단계 정성 등급으로 매핑. 알림 파이프라인은 BullMQ의 3단계 체인(수집→매칭→발송)으로 설계하고, 이메일은 Resend(1인 개발 친화적 무료 티어), 웹 푸시는 `web-push`(VAPID) 표준 라이브러리를 권장한다. **이 조사에서 스키마 설계에 없던 갭 하나를 발견했다** — `notification_settings.push_enabled`는 채널 on/off만 저장하고, 실제 브라우저 푸시 구독 객체(endpoint·keys)를 저장할 테이블이 8개 테이블 어디에도 없다. Phase 2는 `push_subscriptions` 테이블을 추가해야 한다(아래 Common Pitfalls 참고).

**Primary recommendation:** NestJS + Prisma(7.x 고정) + PostgreSQL + Meilisearch + BullMQ(3단계 파이프라인) + Resend(이메일) + web-push(VAPID 푸시) + 국세청 사업자등록정보 진위확인 API(PROF-05)로 스택을 확정하고, db-schema-design.md의 8테이블에 `push_subscriptions` 1개를 추가해 9테이블로 시작한다.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|---------------------|
| PROF-01 | 업체는 업종코드(업태·품목)를 등록할 수 있다 | 실제 저장값은 물품분류번호(대분류/중분류 prefix) — 업종-물품분류-매핑.md §프로필 저장 형식 권장안 계승. 온보딩 UI는 `01-onboarding.md` 스텝 2 |
| PROF-02 | 업체는 활동 지역을 등록할 수 있다 | `companies.region_codes VARCHAR(10)[]` 배열 컬럼(db-schema-design.md §복수성·병합 규칙 (a)) 계승 |
| PROF-03 | 업체는 과거 실적을 등록할 수 있다 | `company_performances` 테이블(선택 입력) — MATCH-01 스코어링의 보조 신호(§Code Examples 결정 6) |
| PROF-04 | 업체는 보유 인증을 등록할 수 있다 | `company_certifications` 테이블 — MATCH-01 스코어링의 보조 신호 |
| PROF-05 | 업체는 사업자등록번호로 가입·인증할 수 있다 | 국세청 사업자등록정보 진위확인 API(§Code Examples), NestJS Passport 인증, AES-256-GCM+HMAC-SHA256 암호화(§Standard Stack, §Security Domain) |
| ING-01 | 시스템은 나라장터 입찰공고를 배치로 자동 수집한다(일 4~6회 폴링) | BullMQ `upsertJobScheduler` cron 잡(§Architecture Patterns Pattern 1) |
| ING-02 | 수집한 공고문에서 품목·지역·참가자격 조건을 파싱해 정규화한다 | `bid_announcements` 정규화 컬럼 + `raw_payload` JSONB 원문 보관(db-schema-design.md 계승) |
| ING-03 | 중복 공고와 개정 공고를 하나로 병합한다 | `UNIQUE(source_bid_no, source_revision_no)` + `is_latest_revision` 플래그(db-schema-design.md §복수성·병합 규칙 (b) 계승, Pitfall 3에서 실데이터 검증 필요성 재확인) |
| ING-04 | 사용자는 공고를 키워드·업종·지역·마감일로 검색·필터링할 수 있다 | Meilisearch 채택(§Standard Stack, §Don't Hand-Roll) |
| MATCH-01 | 시스템은 업체 프로필과 신규 공고를 자동으로 스코어링해 매칭한다 | 100점 만점 스코어링 수식 제안(prefix 60/지역 25/실적·인증 15) + 5단계 등급 매핑(§Code Examples) |
| MATCH-02 | 사용자는 적합도 높은 신규 공고를 이메일로 알림받는다 | Resend + BullMQ 발송 잡(§Architecture Patterns Pattern 1, §Standard Stack) |
| MATCH-03 | 사용자는 적합도 높은 신규 공고를 푸시 알림으로 받는다 | web-push(VAPID) + 신규 `push_subscriptions` 테이블(§Common Pitfalls Pitfall 1) |
| CLIENT-01 | 사용자는 웹 브라우저에서 반응형 UI(Next.js PWA)로 서비스를 이용할 수 있다 | 기존 확정 스택 계승, NestJS REST API가 데이터 공급(§Architectural Responsibility Map) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 나라장터 API 배치 수집(ING-01) | API/Backend (BullMQ 워커) | Database (적재) | 인증키 노출 방지 — 브라우저에서 직접 호출 불가, 서버 사이드 스케줄러 필수 |
| 공고 파싱·정규화(ING-02) | API/Backend | Database | 원문 JSON/XML을 구조화된 컬럼으로 변환하는 로직은 서버 책임 |
| 중복·개정 병합(ING-03) | Database (UNIQUE 제약) | API/Backend (UPSERT 로직) | 스키마 제약이 1차 방어선, 애플리케이션이 UPSERT를 수행 |
| 검색·필터(ING-04) | 검색엔진(Meilisearch) | API/Backend (질의 프록시) | PostgreSQL 전문검색 직접 구현 금지 — Don't Hand-Roll |
| 매칭 스코어링(MATCH-01) | API/Backend (BullMQ 워커) | Database (결과 캐시) | 스코어 계산은 서버 로직, 결과는 `matches` 테이블에 저장해 재사용 |
| 이메일/푸시 발송(MATCH-02/03) | API/Backend (BullMQ 워커 + 외부 서비스) | Database (발송 이력) | 발송 자체는 외부 서비스(Resend/웹푸시 서비스)에 위임, 이력만 서버가 기록 |
| 업체 프로필 CRUD(PROF-01~05) | API/Backend | Database | 서버가 검증 후 저장, 클라이언트는 폼 입력만 담당 |
| 사업자등록번호 진위확인(PROF-05) | API/Backend (외부 API 연동) | Database (판정 상태만 저장) | 원문 응답은 저장하지 않고 상태값만 저장(§민감정보 저장 규칙) |
| 공고 피드·상세·온보딩·알림설정 화면(CLIENT-01) | Frontend (Next.js PWA) | API/Backend (데이터 제공) | 화면은 프론트엔드, 데이터는 API가 공급 |
| 웹 푸시 구독 등록 | Browser/Client (Service Worker) | API/Backend (구독 객체 저장) | Push API 구독은 브라우저가 생성하고 서버가 저장만 함 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| NestJS (`@nestjs/core`, `@nestjs/common`) | 11.2.3 [VERIFIED: npm registry — `npm view @nestjs/core version`] | 백엔드 프레임워크 | PROJECT.md 확정 후보 중 하나이며, 확정 스택인 BullMQ가 Node.js 전용이라 사실상 유일한 정합적 선택 |
| TypeScript | 프로젝트 전역 이미 채택(Next.js+TS) | 정적 타이핑 | 프론트엔드와 언어 통일 — 타입을 API 계약(DTO)까지 공유 가능 |
| Prisma (`prisma`, `@prisma/client`) | **7.10.0으로 고정 설치** — `latest` 태그는 `8.0.0-rc.10`(RC)이므로 사용 금지 [VERIFIED: npm registry — `npm view prisma dist-tags`] | ORM·마이그레이션 | 스키마 파일에서 타입이 생성돼 NestJS DTO와 자연스럽게 맞물림, 마이그레이션 워크플로우가 TypeORM보다 예측 가능 |
| PostgreSQL | 15+ (기존 결정 계승) | 주 데이터베이스 | PROJECT.md 확정 |
| Meilisearch (`meilisearch` JS 클라이언트) | 0.60.0 [VERIFIED: npm registry] / 서버 바이너리는 Docker 이미지로 별도 배포 | 키워드·업종·지역·마감일 검색(ING-04) | 단일 바이너리, JVM 없음, 저메모리 — 1인 운영 부담 최소화 |
| BullMQ | 6.2.2 [VERIFIED: npm registry] | ING-01 배치 폴링 + 매칭 + 알림 발송 파이프라인 | PROJECT.md 확정 스택, Redis 기반 |
| ioredis | 6.0.0 [VERIFIED: npm registry] | BullMQ의 Redis 클라이언트 | BullMQ 공식 권장 클라이언트 |
| Redis | 7.x | BullMQ 브로커 | PROJECT.md 확정 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@nestjs/bullmq` | 11.0.5 [VERIFIED: npm registry] | NestJS ↔ BullMQ 통합 모듈(큐 등록, `@Processor` 데코레이터) | BullMQ를 NestJS 모듈 체계에서 쓸 때 항상 |
| `web-push` | 3.6.7 [VERIFIED: npm registry] | 웹 푸시(VAPID) 발송(MATCH-03) | PWA 브라우저 푸시 — Phase 3의 네이티브 FCM/APNs와는 별개 |
| `resend` | 6.22.1 [VERIFIED: npm registry] | 이메일 발송(MATCH-02) | 무료 티어(월 3,000건)로 MVP 충분, TypeScript SDK 친화적 |
| `class-validator` + `class-transformer` | 11.5.x / 12.5.x대 [VERIFIED: npm registry] | DTO 입력 검증(ASVS V5) | NestJS 표준 검증 파이프 |
| `@nestjs/config` | 8.x대 [VERIFIED: npm registry] | 환경변수 관리(.env) | 서비스키·암호화 키·pepper를 코드에서 분리 |
| `@nestjs/schedule` | 6.x대 [VERIFIED: npm registry] | (선택) 간단한 크론 트리거 | BullMQ 리피터블 잡으로 충분하면 불필요 — 두 스케줄러를 혼용하지 말 것(Anti-Pattern 참고) |
| `@nestjs/passport` + `passport-jwt` | 최신 stable | 계정 인증(세션/JWT) | PROF-05 가입 후 로그인 세션 관리 |
| Node.js 내장 `crypto` (AES-256-GCM, HMAC-SHA256) | Node.js 24 내장(로컬 확인: `node --version` → v24.19.0) [VERIFIED: 로컬 환경] | 사업자등록번호 암호화·다이제스트 | db-schema-design.md §민감정보 저장 규칙의 "애플리케이션 레벨 AEAD" 선택지 — 아래 결정 8 참고 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| NestJS | FastAPI | Python 생태계·문서 자동생성은 우수하나, BullMQ(Redis 큐)가 Node 전용이라 별도 Python 큐(Celery/ARQ) 이중 스택이 필요해짐 — 1인 개발 운영부담 증가로 기각 |
| Prisma | TypeORM 1.1.0(신규 메이저, 2026-05 출시 — 3개월차) | TypeORM은 CHECK 제약을 데코레이터로 직접 표현 가능하나, 1.x 라인이 아직 신생이라 안정성 검증 기간이 짧음. Prisma는 CHECK 제약을 raw migration으로 수동 추가해야 하는 대신(워크플로우 문서화됨, 아래 참고) 타입 안전성·마이그레이션 diff 가독성이 더 높음 |
| Prisma | TypeORM 0.3.x(legacy 태그, 8년 이상 실전 검증) | 검증 기간은 더 길지만, Prisma의 스키마 우선 워크플로우가 1인 개발에 더 적은 인지 부하를 준다는 점에서 여전히 Prisma 우세 — 취향 차이 수준이라 팀 선호가 있으면 TypeORM legacy도 무방 |
| Meilisearch | OpenSearch | OpenSearch는 대규모(수천만 건) 로그·분석에 강하지만 JVM 힙 튜닝·샤드 관리가 필요 — MVP 단계 공고 수(연 수만 건 규모 추정)에는 과설계 |
| Resend | AWS SES + Nodemailer | SES가 이메일당 단가는 4배 저렴(0.10 vs 0.40 USD/1000건)하지만, 도메인 warm-up·반송 처리 인프라를 직접 구축해야 함. 인프라를 AWS 서울 리전으로 정하면 SES가 리전 통합 이점이 있어 재검토 가능 — Phase 2 시작 시점엔 Resend로 빠르게 출시하고 트래픽 증가 시 SES 전환을 권장 |
| Resend | Nodemailer + SMTP(자체 서버) | 벤더 종속 없음이 장점이나 발신 평판(스팸 처리) 관리 부담이 전부 개발자 몫 — 1인 개발엔 부적합 |

**Installation:**
```bash
npm install @nestjs/core @nestjs/common @nestjs/platform-express
npm install prisma@7.10.0 @prisma/client@7.10.0
npm install bullmq@6.2.2 ioredis@6.0.0 @nestjs/bullmq@11.0.5
npm install meilisearch@0.60.0
npm install web-push@3.6.7 resend@6.22.1
npm install class-validator class-transformer @nestjs/config
npm install @nestjs/passport passport passport-jwt
npm install -D prisma  # CLI, devDependency로도 설치 필요
```

**Version verification:** 위 모든 버전은 `npm view <pkg> version` / `npm view <pkg> dist-tags`로 이번 세션에 직접 확인했다(2026-08-26 기준). **주의: `prisma`/`@prisma/client`의 `latest` 태그는 확인 시점 기준 `8.0.0-rc.10`을 가리킨다 — 반드시 버전을 명시해 설치할 것.**

## Package Legitimacy Audit

`gsd-tools query package-legitimacy check`가 아래 패키지 다수를 `SUS`(`too-new`)로 표시했다. **직접 `npm view <pkg> time.created`로 재검증한 결과, 이는 오탐이다** — 이 seam의 "too-new" 휴리스틱이 "최신 버전의 발행 시각"을 패키지 나이로 오인하는 것으로 보인다(활발히 유지보수되는 패키지일수록 최근 발행 시각이 항상 "오늘에 가까워" 트리거됨). 아래 표는 seam 원 판정과, npm 레지스트리에서 직접 확인한 실제 생성일(`time.created`)·주간 다운로드·소스 저장소를 함께 기록한다.

| Package | Registry | 최초 발행일(`time.created`) | Weekly Downloads | Source Repo | Seam Verdict | Disposition |
|---------|----------|------------------------------|-------------------|--------------|---------------|--------------|
| `@nestjs/core` | npm | 2017-05-14 (8년+) | 14,213,003 | github.com/nestjs/nest | SUS(too-new, 오탐) | **승인** — 오탐 재검증 완료 |
| `bullmq` | npm | 2015-04-04 (11년+) | 8,194,065 | github.com/taskforcesh/bullmq | SUS(too-new, 오탐) | **승인** |
| `ioredis` | npm | 2015-03-28 (11년+) | 27,271,957 | github.com/redis/ioredis | SUS(too-new, 오탐) | **승인** |
| `prisma` / `@prisma/client` | npm | 2016-06-03 (10년+) | 16,706,959 | github.com/prisma/prisma | SUS(too-new, 오탐) | **승인** — 단, 위 버전 고정 주의사항 적용 |
| `resend` | npm | 2017-02-25 (9년+) | 10,143,531 | github.com/resend/resend-node | SUS(too-new, 오탐) | **승인** |
| `nodemailer` | npm | 2011-01-21 (15년+) | 20,319,090 | github.com/nodemailer/nodemailer | SUS(too-new, 오탐) | **승인**(대안 후보) |
| `pg` | npm | 2010-12-19 (15년+) | 48,186,773 | github.com/brianc/node-postgres | SUS(too-new, 오탐) | **승인**(Prisma 내부에서 간접 사용) |
| `@aws-sdk/client-ses` | npm | 2020-01-17 (6년+) | 3,831,019 | github.com/aws/aws-sdk-js-v3 | SUS(too-new, 오탐) | **승인**(대안 후보) |
| `@nestjs/bullmq` | npm | 2022-03-02 (4년+) | 1,948,661 | github.com/nestjs/bull | SUS(too-new, 오탐) | **승인** |
| `typeorm` | npm | 2016-04-19 (10년+) | 5,017,456 | github.com/typeorm/typeorm | OK | 승인(대안, 미채택) |
| `web-push` | npm | 2015-09-28 (10년+) | 7,425,100 | github.com/web-push-libs/web-push | OK | **승인** |
| `meilisearch` | npm | 2020-01-20 (6년+) | 564,332 | github.com/meilisearch/meilisearch-js | OK | **승인** |
| `@opensearch-project/opensearch` | npm | 2021-09-30 (4년+) | 2,094,774 | github.com/opensearch-project/opensearch-js | OK | 승인(대안, 미채택) |
| `class-validator` | npm | — | 11,542,022 | github.com/typestack/class-validator | OK | **승인** |
| `class-transformer` | npm | 2021-11-22 (신규 발행, 프로젝트는 그 이전부터 존재) | 12,529,591 | github.com/typestack/class-transformer | OK | **승인** |
| `@nestjs/config` | npm | — | 8,376,682 | github.com/nestjs/config | OK | **승인** |
| `@nestjs/schedule` | npm | — | 4,550,192 | github.com/nestjs/schedule | OK | 승인(선택적) |
| `pgcrypto` | (해당 없음) | — | — | — | SLOP(does-not-exist) | **npm 패키지가 아님** — PostgreSQL 확장(`CREATE EXTENSION pgcrypto`)이며 npm 설치 대상이 아니다. 실수로 조회 목록에 포함시켰음을 여기 기록한다. Phase 2는 어차피 pgcrypto 대신 애플리케이션 레벨 AEAD를 채택한다(결정 8 참고) |

**postinstall 스크립트 점검:** `@nestjs/core`, `bullmq`, `prisma`, `typeorm` 모두 `npm view <pkg> scripts.postinstall`에서 네트워크 호출이나 프로젝트 외부 경로를 참조하는 postinstall 스크립트가 발견되지 않았다.

**Packages removed due to [SLOP] verdict:** none (pgcrypto는 애초에 npm 대상이 아니었을 뿐 slopsquat이 아니다)
**Packages flagged as suspicious [SUS]:** 위 표의 "too-new 오탐" 9건 — 모두 `npm view time.created`로 재검증해 승인했으므로 planner는 이들에 대해 추가 `checkpoint:human-verify`를 넣지 않아도 된다. 다만 **Prisma 버전 고정(7.10.0)** 자체는 설치 태스크에 명시적으로 기록해야 한다(실수로 `latest`를 설치하면 RC가 들어감).

## Architecture Patterns

### System Architecture Diagram

```
[나라장터 Open API 4종]                [국세청 진위확인 API]
   (data.go.kr, XML/JSON)                (data.go.kr)
        |                                      |
        | (1) BullMQ 리피터블 잡: 4~6회/일       | (2) PROF-05 가입 시 1회 호출
        v                                      v
  ┌─────────────────────┐            ┌──────────────────┐
  │ ingest-announcements │            │ NestJS Auth 모듈  │
  │  (BullMQ 워커, ING-01)│            │ (가입/로그인, JWT) │
  └─────────┬────────────┘            └────────┬──────────┘
            │ upsert (source_bid_no+revision)   │ verification_status 갱신
            v                                    v
  ┌────────────────────────────────────────────────────┐
  │           PostgreSQL (Prisma ORM)                    │
  │  companies / company_classification_codes /          │
  │  company_performances / company_certifications /     │
  │  bid_announcements / matches / notification_logs /    │
  │  notification_settings / push_subscriptions(신규)     │
  └───────┬───────────────────────────┬──────────────────┘
          │ (3) 색인 upsert             │ (4) BullMQ: compute-matches
          v                            v
  ┌───────────────┐          ┌──────────────────────┐
  │ Meilisearch    │          │ 스코어링 엔진(§결정6)  │
  │ (ING-04 검색)  │          │ -> matches 테이블 upsert │
  └───────┬────────┘          └──────────┬────────────┘
          │                              │ (5) BullMQ: dispatch-notifications
          │                              v
          │                    ┌──────────────────────┐
          │                    │ notification_settings │
          │                    │ 조회(채널/임계값/방해금지)│
          │                    └──────────┬────────────┘
          │                               │ 조건 통과분만
          │                    ┌──────────┴───────────┐
          │                    v                       v
          │            ┌─────────────┐        ┌──────────────────┐
          │            │ Resend(이메일)│        │ web-push(VAPID 푸시)│
          │            └─────────────┘        └──────────────────┘
          │
          v
  ┌────────────────────────────┐
  │ NestJS REST API (피드/검색)  │  <-- (6) 사용자 요청 시 Meilisearch/Postgres 조회
  └──────────────┬──────────────┘
                 v
  ┌────────────────────────────┐
  │ Next.js PWA (CLIENT-01)     │
  │ 온보딩/피드/상세/알림설정     │
  └────────────────────────────┘
```

### Recommended Project Structure
```
apps/
├── api/                          # NestJS 백엔드
│   ├── src/
│   │   ├── modules/
│   │   │   ├── companies/        # PROF-01~05
│   │   │   ├── announcements/    # ING-01~04
│   │   │   ├── matching/         # MATCH-01 스코어링
│   │   │   ├── notifications/    # MATCH-02~03
│   │   │   └── auth/             # PROF-05 가입/로그인
│   │   ├── queues/
│   │   │   ├── ingest.processor.ts
│   │   │   ├── match.processor.ts
│   │   │   └── notify.processor.ts
│   │   └── main.ts
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/
└── web/                           # Next.js PWA (기존 CLIENT-01 스코프)
```

### Pattern 1: BullMQ 3단계 파이프라인 (수집 → 매칭 → 발송)

**What:** 리피터블 잡(cron)으로 트리거되는 수집 잡이 완료되면 명시적으로 매칭 잡을 enqueue하고, 매칭 잡이 완료되면 발송 잡을 enqueue하는 순차 체인.
**When to use:** ING-01(하루 4~6회 폴링) → MATCH-01(신규/갱신 공고만 재스코어링) → MATCH-02/03(임계값 통과분만 발송)이 항상 이 순서로 실행되어야 할 때.
**Example:**
```typescript
// Source: https://docs.bullmq.io/guide/job-schedulers (upsertJobScheduler 패턴 확인)
// ingest.queue.ts
await ingestQueue.upsertJobScheduler(
  'poll-g2b',
  { pattern: '0 0 */4 * * *' }, // 4시간마다 = 하루 6회 (ING-01)
  { name: 'ingest-announcements', data: {} },
);

// ingest.processor.ts
@Processor('ingest')
export class IngestProcessor extends WorkerHost {
  async process(job: Job) {
    const upserted = await this.ingestService.pollAndUpsert(); // source_bid_no+revision UPSERT
    if (upserted.length > 0) {
      await this.matchQueue.add('compute-matches', { announcementIds: upserted.map(a => a.id) });
    }
  }
}

// match.processor.ts
@Processor('match')
export class MatchProcessor extends WorkerHost {
  async process(job: Job<{ announcementIds: string[] }>) {
    const newMatches = await this.matchingService.scoreAndUpsert(job.data.announcementIds);
    if (newMatches.length > 0) {
      await this.notifyQueue.add('dispatch-notifications', { matchIds: newMatches.map(m => m.id) });
    }
  }
}
```
**참고:** BullMQ `FlowProducer`(부모-자식 잡)는 팬아웃/팬인 구조에 적합하며, 이 프로젝트처럼 순차 체인(A 끝나면 B, B 끝나면 C)에는 각 프로세서 끝에서 다음 큐에 `add()`하는 것이 더 단순하다 [CITED: docs.bullmq.io/guide/flows].

### Pattern 2: 웹 푸시 발송 (VAPID)

**What:** 서비스 워커가 브라우저에서 구독을 생성하면 서버가 `push_subscriptions`에 저장하고, 발송 시 `web-push` 라이브러리로 RFC 8291 암호화 페이로드를 전송한다.
**When to use:** MATCH-03, `notification_settings.push_enabled = true`인 업체에게만.
**Example:**
```typescript
// Source: https://github.com/web-push-libs/web-push (npm 공식 README 확인)
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:support@jodalmate.co.kr',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY, // VAPID 키는 서비스당 1회만 생성해 계속 재사용 — 재생성 시 기존 구독 전부 무효화됨
);

await webpush.sendNotification(
  { endpoint, keys: { p256dh, auth } }, // push_subscriptions 테이블에서 조회
  JSON.stringify({ title: '새 매칭 공고', announcementId }),
  { TTL: 60 * 60 * 24, urgency: 'normal' },
);
```
**주의:** VAPID 키 쌍은 서비스 시작 시 1회 생성 후 `.env`에 고정 보관해야 한다 — 재생성하면 기존에 저장된 모든 구독이 무효화된다.

### Pattern 3: Prisma CHECK 제약 마이그레이션 (db-schema-design.md의 DDL을 그대로 구현)

**What:** Prisma 스키마 언어 자체는 CHECK 제약을 표현하지 못하므로, `migrate dev --create-only`로 빈 마이그레이션을 만든 뒤 SQL을 직접 추가한다.
**When to use:** `company_classification_codes.classification_code`의 `CHECK (length(...) IN (2,4,6,8))` 등 db-schema-design.md가 이미 정의한 모든 CHECK 제약.
**Example:**
```bash
# Source: https://www.prisma.io/docs/orm/v6/more/troubleshooting/check-constraints (공식 문서 확인)
npx prisma migrate dev --create-only --name add_classification_code_check
```
```sql
-- migrations/xxxx_add_classification_code_check/migration.sql (수동 추가)
ALTER TABLE "company_classification_codes"
  ADD CONSTRAINT "chk_ccc_classification_code_length" CHECK (length(classification_code) IN (2, 4, 6, 8)),
  ADD CONSTRAINT "chk_ccc_classification_code_numeric" CHECK (classification_code ~ '^[0-9]+$');
```

### Anti-Patterns to Avoid

- **`@nestjs/schedule`(cron)와 BullMQ 리피터블 잡을 동시에 쓰는 것:** 두 스케줄러가 같은 폴링 책임을 중복으로 가지면 어느 쪽이 실제 실행 중인지 추적하기 어려워진다 — ING-01은 BullMQ 하나로 통일.
- **`prisma`를 버전 지정 없이 설치:** `latest` 태그가 RC를 가리키는 현재 상태에서는 반드시 `prisma@7.10.0` 형태로 고정 설치.
- **매칭 스코어를 사용자에게 숫자·백분율로 노출:** `02-feed.md`가 이미 5단계 정성 등급만 노출하기로 결정했다 — 이 결정은 Legal 제약(낙찰 보장 표현 금지)과 직결되므로 백엔드가 원점수를 API 응답에 그대로 흘려보내는 실수를 하지 않아야 한다(정성 등급으로 변환 후 응답).
- **`business_reg_no`를 pgcrypto로 암호화하면서 동시에 애플리케이션 AEAD도 쓰는 이중 암호화:** db-schema-design.md는 둘 중 하나를 선택하라고 명시했다 — 이 문서는 애플리케이션 레벨 AES-256-GCM을 권장한다(결정 8).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 전문 검색(ING-04) | PostgreSQL `LIKE`/`tsvector` 직접 구현 | Meilisearch | db-schema-design.md가 이미 경계로 명시, 검색 랭킹·오타 허용 로직을 자체 구현하면 유지보수 비용이 검색엔진 운영비보다 커짐 |
| 웹 푸시 암호화(RFC 8291) | 직접 ECDH+AES-GCM 페이로드 암호화 구현 | `web-push` 라이브러리 | 웹 푸시 프로토콜의 암호화 규격을 잘못 구현하면 조용히 발송 실패함 — 표준 라이브러리가 이미 해결 |
| 사업자등록번호 진위 확인 | 체크섬 정규식만으로 "진짜 사업자"라고 판단 | 국세청 사업자등록정보 진위확인 API | 체크섬 통과는 형식 유효성만 보장하지 실재 여부는 보장하지 않음(PROF-05) |
| 사업자등록번호 암호화 | 자체 AES 구현 또는 단순 SHA-256 해시 | Node.js 내장 `crypto`(AES-256-GCM) + HMAC-SHA256(pepper) | db-schema-design.md §민감정보 저장 규칙이 이미 "자체 암호 알고리즘 구현 금지"를 명시 |
| BullMQ 리피터블 잡 재구현(setInterval 등) | 자체 타이머 기반 폴링 스케줄러 | BullMQ `upsertJobScheduler` | 프로세스 재시작 시 중복 실행·잡 유실 방지가 이미 구현되어 있음 |
| 매칭 결과 캐싱/무효화 로직 | 자체 캐시 레이어 | `matches` 테이블 UPSERT(스키마에 이미 UNIQUE 제약 존재) | DB 자체가 이미 재계산 시 멱등성을 보장하도록 설계됨 |

**Key insight:** 이 Phase의 대부분 "hand-roll 금지" 항목은 이미 db-schema-design.md와 업종-물품분류-매핑.md가 못 박아 놓았다 — Phase 2 구현자는 새 결정을 내리기보다 이미 문서화된 제약을 정확히 구현하는 데 집중해야 한다.

## Common Pitfalls

### Pitfall 1: `push_subscriptions` 테이블 누락
**What goes wrong:** db-schema-design.md의 8개 테이블에는 브라우저 푸시 구독 객체(`endpoint`, `keys.p256dh`, `keys.auth`)를 저장할 테이블이 없다. `notification_settings.push_enabled`는 on/off 플래그일 뿐 실제 발송 대상(구독 객체)을 담지 못한다.
**Why it happens:** db-schema-design.md는 D-04/D-05 근거로 "Phase 2 MVP 핵심 테이블"만 설계했는데, 이 세부 테이블이 누락으로 지나쳤다 — 이 문서가 처음 발견한 갭이다.
**How to avoid:** Phase 2 스키마 마이그레이션에 아래 테이블을 추가한다.
```sql
CREATE TABLE push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (endpoint)
);
```
(하나의 업체가 여러 기기/브라우저에서 구독할 수 있으므로 `company_id` 1:N — `notification_settings`처럼 1:1이 아니다.)
**Warning signs:** MATCH-03 구현 태스크에서 "구독 정보를 어디서 읽어오나?"라는 질문에 답할 테이블이 없는 경우.

### Pitfall 2: Prisma `latest` 태그 설치 시 RC 빌드 유입
**What goes wrong:** `npm install prisma @prisma/client`만 실행하면 현재 `8.0.0-rc.10`이 설치된다.
**Why it happens:** Prisma 팀이 메이저 버전 전환기에 `latest` dist-tag를 RC로 옮겨둔 상태(이번 세션에 `npm view prisma dist-tags`로 직접 확인).
**How to avoid:** 설치 태스크에 정확한 버전(`prisma@7.10.0`)을 명시.
**Warning signs:** `package.json`에 `"prisma": "^8.0.0-rc.10"` 같은 프리릴리스 버전 문자열이 보이는 경우.

### Pitfall 3: 나라장터 API 개발계정 트래픽 한도 수치의 출처 간 불일치
**What goes wrong:** Phase 1 RESEARCH.md는 "개발계정 일 평균 1,000건"이라 보고했으나, 이번 세션 WebSearch는 관련 나라장터 서비스군에서 "개발계정 10,000건/일, 계약과정통합공개서비스만 1,000건/일"이라는 다른 수치를 보고했다.
**Why it happens:** 나라장터 산하 서비스마다(입찰공고정보/사전규격/낙찰정보/계약정보) 한도가 다를 수 있고, 두 세션 모두 공식 Swagger 문서 원문을 직접 열람하지 못해 2차 출처(WebSearch 요약)에 의존했다.
**How to avoid:** Phase 1 산출물인 `api-신청-체크리스트.md`의 실제 승인 화면(마이페이지 > API활용현황)에서 4개 서비스 각각의 실제 한도를 1회 확인하고 그 값을 Phase 2 착수 태스크에 기록한다 — 이 문서의 두 수치 중 하나를 그냥 믿지 말 것.
**Warning signs:** ING-01 폴링 잡이 배포 직후 "일일 한도 초과" 오류로 실패.

### Pitfall 4: BullMQ 워커와 NestJS HTTP 서버를 같은 프로세스에서 무제한 동시 실행
**What goes wrong:** 나라장터 API 폴링(느린 외부 I/O)과 REST API 응답(빠른 응답 필요)이 같은 이벤트 루프를 공유하면, 대량 페이지네이션 수집 중 사용자 요청 지연이 발생할 수 있다.
**Why it happens:** NestJS 기본 예제는 워커와 API를 한 프로세스에 합치는 경우가 많다.
**How to avoid:** MVP 초기에는 한 프로세스로 시작해도 무방하나(1인 개발 우선), `@nestjs/bullmq`의 워커 동시성(`concurrency`) 옵션을 낮게 설정해 영향을 제한하고, 트래픽이 늘면 워커를 별도 프로세스(`node dist/worker.js`)로 분리한다.
**Warning signs:** 배치 실행 시간대에 피드 API 응답 지연이 체감되는 경우.

## Code Examples

### MATCH-01 스코어링 함수 (제안 — Phase 2에서 확정·튜닝 필요)

```typescript
// 제안 수식 — 이 세션에서 새로 설계, [ASSUMED] 100% (기존 문서에 수식 자체가 없었음)
// 최대 100점: 분류코드 prefix 일치(60) + 지역 일치(25) + 실적/인증 보조신호(15)
function scoreMatch(company: CompanyProfile, announcement: BidAnnouncement): number {
  let score = 0;

  // (1) 분류코드 prefix 일치 — 자릿수가 길수록 가중치 높음 (업종-물품분류-매핑.md §매칭 규칙 (b))
  const bestMatchLength = company.classificationCodes
    .filter(code => announcement.classificationCode?.startsWith(code))
    .reduce((max, code) => Math.max(max, code.length), 0);
  const prefixScoreTable: Record<number, number> = { 8: 60, 6: 45, 4: 30, 2: 15, 0: 0 };
  score += prefixScoreTable[bestMatchLength] ?? 0;

  // 분류코드가 비어 있는 공고는 완전 배제하지 않고 낮은 고정 점수로 후보에 남김
  // (db-schema-design.md §스파인이 강제하는 설계 제약 (c))
  if (!announcement.classificationCode) {
    score = Math.max(score, 20); // 키워드 매치는 검색엔진(Meilisearch) 별도 경로에서 처리
  }

  // (2) 지역 일치 — 배열 컬럼 교집합
  const regionOverlap = company.regionCodes.some(r => announcement.regionCodes.includes(r));
  if (announcement.regionCodes.length === 0) {
    score += 15; // 전국 공고(지역 제한 없음) — 부분 가점
  } else if (regionOverlap) {
    score += 25;
  }

  // (3) 실적/인증 보조 신호 — MVP는 "존재 여부"만 반영, 세부 관련성 매칭은 이후 Phase 과제
  if (company.performances.length > 0) score += 10;
  if (company.certifications.length > 0) score += 5;

  return Math.min(score, 100);
}

// 5단계 정성 등급 매핑 (02-feed.md UI 계약)
function toQualitativeTier(score: number): '매우 적합' | '적합' | '보통' | '낮음' | '참고용' {
  if (score >= 85) return '매우 적합';
  if (score >= 70) return '적합';
  if (score >= 55) return '보통';
  if (score >= 35) return '낮음';
  return '참고용';
}
// notification_settings.min_score_threshold 기본값 60.00은 '보통' 등급 하한 부근에 위치 —
// 기본 설정으로는 '보통' 등급 이상만 알림이 발송된다.
```
**중요:** 이 수식은 이번 세션이 처음 제안하는 것으로 실데이터 검증이 전혀 없다 — Phase 2 실행 중 초기 시드 데이터로 점수 분포를 확인하고 가중치를 조정해야 한다. `notification_settings.min_score_threshold`가 이미 사용자별로 튜닝 가능하므로, 초기 가중치가 다소 부정확해도 사용자가 슬라이더로 보정할 수 있다(안전망 존재).

### 사업자등록번호 진위확인 API 호출 (PROF-05)

```typescript
// Source: data.go.kr/data/15081808/openapi.do (WebSearch로 서비스 개요 확인, MEDIUM)
// 정확한 요청 파라미터명은 활용신청 승인 후 Swagger 문서에서 재확인 필요
async function verifyBusinessRegistration(bizNo: string, openDate: string, repName: string) {
  const res = await fetch(
    `https://api.odcloud.kr/api/nts-businessman/v1/validate?serviceKey=${process.env.NTS_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businesses: [{ b_no: bizNo, start_dt: openDate, p_nm: repName }],
      }),
    },
  );
  const data = await res.json();
  // data.data[0].valid === '01' → 진위 확인됨, '02' → 확인 불가
  return data.data[0].valid === '01' ? 'verified' : 'failed';
}
```
**주의:** 응답 원문 전체는 저장하지 않고 `verification_status`(`pending`/`verified`/`failed`)만 저장한다(db-schema-design.md §민감정보 저장 규칙, PROF-05).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| BullMQ `queue.add(name, data, { repeat: { cron } })` | `queue.upsertJobScheduler(id, { pattern }, template)` | BullMQ 5.16.0+ | 리피터블 잡 중복 생성 방지 로직이 내장됨 — 신규 코드는 `upsertJobScheduler` 사용 권장 |
| Prisma 5.x/6.x 안정 라인 | Prisma 7.x 안정 / 8.0.0-rc가 `latest` 태그 | 확인 시점(2026-08) | 설치 시 버전을 명시하지 않으면 프리릴리스가 들어감 |
| TypeORM 0.3.x | TypeORM 1.0.0(2026-05 출시, 1.1.0 최신) | 2026-05 | 아직 3개월차 메이저 — 이 프로젝트는 채택하지 않고 Prisma로 결정했으므로 영향 없음, 향후 재검토 시 참고 |

**Deprecated/outdated:** 없음 — 이 Phase에서 다루는 라이브러리 중 공식적으로 deprecated 표시된 것은 확인되지 않았다.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | MATCH-01 스코어링 수식(prefix 60점/지역 25점/실적·인증 15점, 5단계 등급 경계값) | Code Examples > MATCH-01 스코어링 함수 | 이 프로젝트 최초 제안이며 실데이터 검증 없음 — 초기 사용자에게 부적합한 등급이 노출될 수 있으나 `min_score_threshold`로 사용자가 보정 가능해 치명적이지는 않음 |
| A2 | 나라장터 개발계정 트래픽 한도가 "10,000건/일"이라는 이번 세션 수치(Phase 1 문서의 "1,000건/일"과 상충) | Common Pitfalls > Pitfall 3 | 실제 한도를 확인하지 않고 배치 설계를 하면 트래픽 초과 또는 과소 설계 가능 |
| A3 | 국세청 진위확인 API의 정확한 엔드포인트 URL·요청 파라미터명(`b_no`, `start_dt`, `p_nm` 등) | Code Examples > 사업자등록번호 진위확인 API 호출 | 활용신청 승인 후 실제 Swagger 문서와 다르면 인증 연동 코드를 재작성해야 함 |
| A4 | `push_subscriptions` 테이블 설계(컬럼 구성)가 이번 세션이 새로 제안한 것으로 db-schema-design.md의 검토를 거치지 않음 | Common Pitfalls > Pitfall 1 | 표준적인 Web Push 구독 객체 형태를 따랐으나, DB 마이그레이션 확정 전 재검토 권장 |
| A5 | 프로젝트가 실제로 AWS 서울 리전 대신 NCP를 선택할 경우 Resend/AWS SES 어느 쪽이 리전 이점을 갖는지는 인프라 Phase(미정)의 몫으로 남김 | Standard Stack > Alternatives Considered | 인프라 확정 전까지는 이메일 발송 서비스가 국내 리전 요구사항과 무관하게 SaaS(Resend)로 시작해도 무방 — 서비스 자체가 국내 리전에 데이터를 상시 저장하지 않는 발송 대행이기 때문 |

## Open Questions

1. **나라장터 4개 서비스 각각의 정확한 일일 트래픽 한도는?**
   - What we know: 최소 2개 서로 다른 수치(1,000건/일, 10,000건/일)가 서로 다른 세션에서 보고됨
   - What's unclear: 어느 쪽이 이 4개 서비스(입찰공고정보/사전규격정보/낙찰정보/계약정보)에 실제로 적용되는지
   - Recommendation: Phase 2 착수 직후 data.go.kr 마이페이지 > API활용현황에서 직접 확인(사람 액션)

2. **국세청 사업자등록정보 진위확인 API의 정확한 엔드포인트·파라미터 스펙**
   - What we know: 서비스가 존재하고(data.go.kr/data/15081808), 대략적 호출 한도(100건/콜, 100만건/일)는 확인됨
   - What's unclear: 정확한 REST 엔드포인트 URL, 요청/응답 JSON 스키마
   - Recommendation: 활용신청 승인 후 공식 Swagger/참고문서로 재확인 — Code Examples의 스니펫은 공개된 유사 사례(velog, r2bit.com 등 2차 출처) 패턴을 참고한 것으로 원문 미확인

3. **MATCH-01 스코어링 가중치의 실사용자 검증**
   - What we know: 제안한 수식이 계산 가능하고 5단계 등급과 정합적으로 매핑됨
   - What's unclear: 실제 사용자에게 이 가중치 비율(60/25/15)이 체감상 적절한지
   - Recommendation: Phase 2 초기 시드 데이터로 점수 분포 히스토그램을 뽑아보고, `min_score_threshold` 기본값(60.00)이 실제로 "적당한 양"의 알림을 발생시키는지 확인 후 조정

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | 전체 백엔드(NestJS)·프론트엔드 | ✓ | v24.19.0 [VERIFIED: 로컬 `node --version`] | — |
| npm | 패키지 관리 | ✓ | 11.17.0 [VERIFIED: 로컬 `npm --version`] | — |
| Git | 버전 관리 | ✓ | 2.55.0 [VERIFIED: 로컬 `git --version`] | — |
| Docker | 로컬 PostgreSQL/Redis/Meilisearch 개발환경 | ✗ | — | Docker Desktop 설치 필요, 또는 각 서비스를 로컬에 직접 설치(Windows 환경이라 WSL2 경유 Docker 권장) |
| PostgreSQL 클라이언트(`psql`) | DB 마이그레이션 확인 | ✗ | — | Docker 컨테이너 내부에서 `psql` 실행하거나 Prisma Studio로 대체 |
| Redis(`redis-cli`) | BullMQ 로컬 개발 | ✗ | — | Docker 컨테이너로 대체(`docker run redis:7`) |

**Missing dependencies with no fallback:**
- 없음 — 아래 "fallback" 있는 항목으로 모두 해소 가능

**Missing dependencies with fallback:**
- Docker/psql/redis-cli 미설치 — Phase 2 착수 첫 태스크로 Docker Desktop(Windows, WSL2 backend) 설치 후 `docker-compose.yml`로 PostgreSQL+Redis+Meilisearch 로컬 스택을 한 번에 구동하는 것을 권장. Docker를 쓰지 않으려면 각 서비스의 Windows 네이티브 설치가 필요하나 운영 환경(NCP/AWS 서울)과 로컬 환경 일치를 위해 Docker 권장.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (NestJS 기본 내장 테스트 러너) — 신규 프로젝트라 아직 설치 전 |
| Config file | none — Wave 0에서 `nest new`가 기본 `jest.config.js`를 생성함 |
| Quick run command | `npm run test -- --testPathPattern=matching` (스코어링 로직 단위테스트만) |
| Full suite command | `npm run test` (단위) + `npm run test:e2e` (NestJS 기본 e2e 러너) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| PROF-05 | 사업자등록번호 형식 검증(자릿수·체크섬) + 진위확인 API 연동 | unit + integration(API mock) | `npm run test -- companies.service.spec.ts` | ❌ Wave 0 |
| ING-03 | 개정 공고 병합(UNIQUE + is_latest_revision) | integration(DB) | `npm run test -- announcements.service.spec.ts` | ❌ Wave 0 |
| MATCH-01 | 스코어링 함수가 prefix 자릿수·지역·실적을 올바르게 반영 | unit | `npm run test -- matching.service.spec.ts` | ❌ Wave 0 |
| MATCH-02/03 | 알림 발송 조건(임계값·채널·중복방지 UNIQUE) 준수 | integration | `npm run test -- notifications.service.spec.ts` | ❌ Wave 0 |
| ING-04 | 키워드·업종·지역·마감일 검색 필터가 Meilisearch 질의로 올바르게 변환 | integration(Meilisearch testcontainer 또는 로컬 인스턴스) | `npm run test:e2e -- search.e2e-spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- --testPathPattern=<변경된 모듈>`
- **Per wave merge:** `npm run test && npm run test:e2e`
- **Phase gate:** 전체 스위트 green 후 `/gsd-verify-work`

### Wave 0 Gaps
- [ ] NestJS 프로젝트 스캐폴딩(`nest new`) 및 Jest 기본 설정 — 아직 코드베이스 자체가 없음
- [ ] `prisma/schema.prisma` 초안 + 최초 마이그레이션 — db-schema-design.md의 DDL을 Prisma 스키마로 변환
- [ ] Meilisearch 로컬 테스트 인스턴스(Docker) — `ING-04` 통합테스트 전제조건
- [ ] `tests/fixtures/` — 시드 회사·공고 데이터(스코어링 검증용)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | 예 | `@nestjs/passport` + `passport-jwt`, 비밀번호 해시는 `bcrypt`(NestJS 표준 관례) — 자체 구현 금지 |
| V3 Session Management | 예 | JWT 만료시간·리프레시 토큰 전략(NestJS 공식 가이드 패턴 준수) |
| V4 Access Control | 예 | 모든 매칭·알림 조회 쿼리에 `company_id` 스코프 필터 강제(db-schema-design.md Phase 2 인계 사항 5 — T-01-12) |
| V5 Input Validation | 예 | `class-validator` DTO — 사업자등록번호 자릿수·체크섬, `classification_code` 자릿수(2/4/6/8)·숫자 패턴 등 db-schema-design.md의 CHECK 제약과 동일한 규칙을 API 레이어에서도 검증 |
| V6 Cryptography | 예 | 사업자등록번호: Node.js 내장 `crypto`(AES-256-GCM 암호화 + HMAC-SHA256 다이제스트, pepper는 환경변수). 커스텀 암호 알고리즘 금지 |
| V9 Communication | 예 | 나라장터/국세청 API 키는 HTTPS 전용, `.env`/시크릿 매니저 보관, git 미포함 |

### Known Threat Patterns for 이 스택

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| 타 업체 매칭·알림 데이터 노출(`company_id` 스코프 누락) | Information Disclosure | 모든 Prisma 쿼리에 `where: { companyId }` 강제 — 리포지토리 계층에서 이 필터를 빠뜨릴 수 없게 헬퍼 함수로 감싸는 것을 권장 |
| 다른 업체의 `match_id`로 공고 상세 접근(`03-detail.md` 엣지 케이스) | Elevation of Privilege | 조회 시 `matches.company_id = 로그인 업체` 검증 후 403 반환(T-01-16) |
| 웹 푸시 구독 엔드포인트 탈취/재사용 | Spoofing | `push_subscriptions.endpoint`에 UNIQUE 제약 + company_id 소유권 검증 없이 발송 API를 외부에 노출하지 않음(발송은 서버 내부 큐에서만 트리거) |
| 사업자등록번호 다이제스트 컬럼 유출 후 전수 역산 공격 | Information Disclosure | 단순 SHA-256 금지, 서버 pepper를 섞은 HMAC-SHA256만 사용(db-schema-design.md §민감정보 저장 규칙에 이미 명시) |
| Resend/web-push API 키 유출 | Information Disclosure | `.env`/`@nestjs/config` + 시크릿 매니저, 로그에 페이로드 전체를 남기지 않음(이메일 본문에 개인정보 포함 가능) |

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view <pkg> version` / `dist-tags` / `time.created` / `scripts.postinstall`) — 이번 세션에서 직접 실행해 확인한 버전·발행일·다운로드 수·postinstall 스크립트 부재
- `docs/design/db-schema-design.md`, `docs/design/업종-물품분류-매핑.md`, `docs/design/wireframes/*.md` — Phase 1 확정 산출물, 이 문서 전반의 근거

### Secondary (MEDIUM confidence)
- https://docs.bullmq.io/guide/job-schedulers — `upsertJobScheduler` 공식 문서
- https://docs.bullmq.io/guide/flows — FlowProducer 공식 문서
- https://github.com/web-push-libs/web-push — web-push 공식 README
- https://www.prisma.io/docs/orm/v6/more/troubleshooting/check-constraints — Prisma CHECK 제약 워크어라운드 공식 문서
- https://www.prisma.io/docs/orm/prisma-migrate/workflows/native-database-types — Postgres 배열 네이티브 지원 공식 문서
- https://postgresql.org 메일링리스트(text_pattern_ops 컬럼-컬럼 조인 한계에 관한 개발자 답변) — WebSearch로 확인
- https://www.data.go.kr/data/15081808/openapi.do — 국세청 사업자등록정보 진위확인 서비스 개요
- https://www.meilisearch.com/docs/resources/comparisons/opensearch — Meilisearch 공식 비교 문서

### Tertiary (LOW confidence)
- 나라장터 개발계정 트래픽 한도 수치(1,000건 vs 10,000건) — 서로 다른 세션에서 상충하는 2차 출처(WebSearch 요약), 원문 미확인(Open Question 1)
- 국세청 진위확인 API 정확한 요청 파라미터명(`b_no`, `start_dt`, `p_nm`) — velog/r2bit.com 등 개인 블로그의 사용 예시에서 유추, 공식 Swagger 미확인(Open Question 2)
- MATCH-01 스코어링 수식 전체 — 이 세션이 처음 설계한 제안으로 외부 출처 없음(Assumption A1)

## Metadata

**Confidence breakdown:**
- Standard stack(NestJS/Prisma/Meilisearch/BullMQ 선택): HIGH — 각 패키지의 존재·버전·성숙도는 npm 레지스트리로 직접 검증, BullMQ가 백엔드 언어를 결정한다는 논리는 PROJECT.md 원문에서 직접 도출
- 아키텍처 패턴(파이프라인·CHECK 제약 마이그레이션): MEDIUM — 공식 문서 기반이나 이 프로젝트 코드베이스에 실제 적용해 검증한 적은 없음
- 스코어링 수식: LOW — 이 세션의 순수 제안, 실데이터 검증 없음(Assumption A1)
- 나라장터/국세청 API 세부 스펙: LOW-MEDIUM — 서비스 존재와 대략적 한도는 확인, 정확한 필드명은 활용신청 승인 후 재확인 필요

**Research date:** 2026-08-26
**Valid until:** 2026-09-09 (약 2주 — npm 패키지 버전, 특히 Prisma의 RC→stable 전환 시점이 유동적이라 짧은 유효기간 권장)
