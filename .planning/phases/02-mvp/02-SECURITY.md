---
phase: 02
slug: mvp
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-27
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser(회원가입/로그인) → NestJS API | 미신뢰 사용자 입력(사업자등록번호·비밀번호) | 평문 자격증명 |
| NestJS API → PostgreSQL | 암호화된 사업자등록번호·비밀번호 해시 저장 | AES-256-GCM 암호문, scrypt 해시 |
| JWT 소유자 ↔ 리소스 소유자 | 모든 프로필/매칭/알림 하위 리소스는 company_id 소유권 검증 필요 | company_id 스코프 |
| 나라장터 Open API(외부) → NestJS 워커 | 신뢰할 수 없는 원문 JSON/XML | 공고 원문 |
| Browser → NestJS API → Meilisearch | 프론트는 Meilisearch를 직접 호출하지 않고 API만 경유 | 검색 키워드, 색인 결과 |
| NestJS 워커 → Resend/web-push(외부) | 이메일 발송, 웹 푸시 outbound 요청 | 공고명·업체 이메일, 클라이언트 제출 push endpoint |
| Browser → POST /push-subscriptions | 클라이언트가 제출한 endpoint URL — 서버가 이후 이 값으로 outbound HTTP 요청을 보냄(SSRF 표면) | push 구독 endpoint URL |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Spoofing | JWT 서명 (jwt.strategy.ts) | high | mitigate | env secret, `ignoreExpiration:false`, passport-jwt 표준 검증, 24h 만료 (auth.service.ts) | closed |
| T-02-02 | Tampering | business_reg_no 저장 (business-reg-no.crypto.ts) | high | mitigate | AES-256-GCM, 12B random IV, authTag로 무결성 보장 | closed |
| T-02-03 | Information Disclosure | business_reg_no_digest 유출 후 역산 | high | mitigate | HMAC-SHA256(bizNo, pepper) — 단순 SHA-256 아님 | closed |
| T-02-04 | Information Disclosure | password_hash 유출 후 역산 (password.crypto.ts) | high | mitigate | scrypt N=16384, 사용자별 랜덤 salt, timingSafeEqual | closed |
| T-02-05 | Denial of Service | 회원가입 엔드포인트 스팸 | medium | accept | MVP 범위에서 rate limiting 보류, UNIQUE 제약이 최소 방어선 | closed |
| T-02-18 | Information Disclosure | 로그인 실패 응답으로 계정 존재 여부 열거 | medium | mitigate | 동일 401+동일 문구, 미존재 시 더미 해시 비교로 타이밍 최소화 | closed |
| T-02-19 | Denial of Service | 로그인 엔드포인트 무차별 대입 | medium | accept | rate limiting 보류(T-02-05 동일 판단), scrypt 계산비용이 1차 완화 | closed |
| T-02-06 | Elevation of Privilege | classification-codes/performances/certifications DELETE | high | mitigate | 모든 삭제·조회 쿼리 `WHERE company_id = jwtCompanyId` 강제 (companies.service.ts) | closed |
| T-02-07 | Tampering | classification_code 형식 위조 | medium | mitigate | class-validator DTO + DB CHECK 제약 이중 검증 | closed |
| T-02-08 | Information Disclosure | 실적 계약금액 등 민감 정보 노출 | low | accept | 소유 업체 본인 조회로만 제한, 별도 공개 API 없음 | closed |
| T-02-09 | Tampering | 원문 파싱 결과와 실제 나라장터 공고 불일치 | high | mitigate | raw_payload 원문 보관 + 상세 화면 원문 링크 필수 배치 | closed |
| T-02-10 | Denial of Service | 나라장터 API 일일 호출 한도 초과 | high | mitigate | INGEST_CRON_PATTERN 환경변수화, 기본값 4시간(6회/일) | closed |
| T-02-11 | Information Disclosure | G2B/국세청 API 키가 로그에 노출 | medium | mitigate | 현재 로그 지점(g2b-announcement-source.adapter.ts, nts-verification.adapter.ts)은 키를 로깅하지 않음 — 다만 마스킹 헬퍼가 구조적으로 존재하지 않아 향후 로그 추가 시 재발 가능. NTS 키는 쿼리스트링으로 전송되어 프록시 접근 로그에 남을 수 있음 | open — below high threshold (non-blocking) |
| T-02-12 | Elevation of Privilege | 다른 업체의 match_id로 상세 접근 | high | mitigate | matches.company_id 소유권 검증 → 불일치 시 403, ParseUUIDPipe로 malformed id 차단 | closed |
| T-02-13 | Information Disclosure | GET /feed 응답에 원점수 노출 | medium | mitigate | DTO가 score 필드 자체를 직렬화하지 않음, 정성 등급만 포함 (Legal 제약) | closed |
| T-02-14 | Tampering | Meilisearch 마스터키가 프론트에 노출 | high | mitigate | 프론트는 Meilisearch 직접 호출 안 함, 마스터키는 서버 환경변수에만 존재 | closed |
| T-02-15 | Spoofing | 웹 푸시 구독 엔드포인트 탈취·재사용 | medium | mitigate | endpoint UNIQUE + company_id 소유권 검증, 발송은 내부 큐에서만 트리거 | closed |
| T-02-16 | Information Disclosure | Resend/web-push API 키·VAPID 개인키 유출 | high | mitigate | .env/@nestjs/config에만 보관, 에러 로그에 error.message만 기록(본문·키 미기록) | closed |
| T-02-17 | Tampering | notification_settings를 타 업체가 변경 | high | mitigate | PATCH 시 JWT company_id로만 자신의 행을 갱신 | closed |
| T-02-20 | Information Disclosure | docker-compose 기본 계정/포트가 로컬에 노출 | low | accept | 로컬 개발 전용, .env는 gitignore, .env.example은 자리표시자만 | closed |
| T-02-21 | Elevation of Privilege / SSRF | 웹 푸시 구독 endpoint로 서버발 outbound 요청 (create-push-subscription.dto.ts, web-push.service.ts) | high | mitigate | (2026-08-27 수정) DTO 검증에서 리터럴 사설/루프백/링크로컬 IP 거부 + 발송 직전 DNS 재조회로 리바인딩까지 차단 (ssrf-guard.ts, 커밋 990391d) — 02-secure-phase 감사에서 최초 발견(blind SSRF, 사설 IP 리터럴 통과) 후 즉시 수정 | closed |
| T-02-SC (02-01) | Tampering | npm install(prisma/passport 계열) | high | accept | RESEARCH.md Package Legitimacy Audit — time.created 재검증 완료 | closed |
| T-02-SC (02-05) | Tampering | npm install(bullmq/ioredis/@nestjs/bullmq) | high | accept | RESEARCH.md Package Legitimacy Audit에서 재검증·승인 | closed |
| T-02-SC (02-06) | Tampering | npm install(meilisearch) | high | accept | RESEARCH.md Package Legitimacy Audit에서 승인(OK 판정) | closed |
| T-02-SC (02-07) | Tampering | npm install(resend, web-push) | high | accept | RESEARCH.md Package Legitimacy Audit에서 승인 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on(high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-02-05, T-02-19 | Rate limiting을 MVP 범위에서 보류 — scrypt 계산비용 및 UNIQUE 제약이 1차 방어선. 남용 관찰 후 후속 phase에서 도입 | Project owner (via /gsd-secure-phase) | 2026-08-27 |
| AR-02 | T-02-08 | 실적 계약금액은 소유 업체 본인 조회로만 제한되며 별도 공개 API가 없어 노출 경로 없음 | Project owner (via /gsd-secure-phase) | 2026-08-27 |
| AR-03 | T-02-20 | 로컬 개발 전용 docker-compose 기본 계정 — 운영 배포 시 별도 시크릿 관리로 교체 예정(인프라 phase 범위) | Project owner (via /gsd-secure-phase) | 2026-08-27 |
| AR-04 | T-02-SC (전체) | 신규 npm 의존성은 RESEARCH.md Package Legitimacy Audit에서 이미 개별 재검증·승인됨 | Project owner (via /gsd-secure-phase) | 2026-08-27 |

*Accepted risks do not resurface in future audit runs.*

---

## Hardening Notes (non-blocking, outside the register)

이번 감사에서 발견됐으나 severity/영향이 register 항목으로 격상시킬 수준은 아닌 항목 — 다음 phase 또는 여유 있을 때 처리 권장:

1. **JWT_SECRET 길이 미검증.** T-02-01 계획은 "32바이트+"를 요구하지만 코드에서 실제 길이를 assert하지 않음(`business-reg-no.crypto.ts`는 동일 패턴을 이미 구현하고 있어 참고 가능).
2. **푸시 구독 재점유.** `notifications.service.ts`가 endpoint 기준 UPSERT를 수행 — 다른 업체가 동일 endpoint URL을 알게 되면 자신의 것으로 재등록 가능(의도된 "기기 재구독" 동작으로 문서화돼 있으나 ASVS L2에서는 T-02-15 소유권 주장을 일부 약화시킴).
3. **기본 이메일 어댑터가 PII를 로깅.** `EMAIL_ADAPTER` 기본값이 `console`이라 배포 시 이 값을 바꾸는 것을 잊으면 수신자 이메일·공고명이 로그에 남음(API 키 유출은 아니므로 T-02-16은 closed 유지) — 운영 기동 시 가드 추가 권장.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-27 | 25 | 24 | 1 (non-blocking) | gsd-security-auditor (initial, register_authored_at_plan_time: true, ASVS L1) — found T-02-21 OPEN/blocking |
| 2026-08-27 | 25 | 25 | 1 (T-02-11, non-blocking) | Orchestrator — T-02-21 fixed same-day (commit 990391d: ssrf-guard.ts), threats_open (>=high) confirmed 0 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-27
