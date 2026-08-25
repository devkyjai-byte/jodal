---
phase: 1
slug: prep
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | 없음 — 이 Phase는 애플리케이션 코드를 생성하지 않는다(CONTEXT.md D-04/D-05). 자동화 테스트(pytest/jest 등)는 적용되지 않는다. |
| **Config file** | none |
| **Quick run command** | 해당 없음 |
| **Full suite command** | 해당 없음 |
| **Estimated runtime** | 해당 없음 |

---

## Sampling Rate

이 Phase는 코드 실행형 검증 대신 산출물 존재·완결성 확인으로 대체한다. 각 태스크 완료 시 해당 산출물 파일의 존재와 필수 내용을 확인하고, Phase 종료 전 아래 Success Criteria → 검증 방법 매핑을 전부 통과해야 한다.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-* | 01 | 1 | SC-1 (API 신청) | — | 인증키를 문서/git에 노출하지 않음 | manual | 해당 없음 | ❌ N/A | ⬜ pending |
| 01-01-* | 01 | 1 | SC-2 (업종-분류 매핑) | — | N/A | file-existence | `test -f 업종-물품분류-매핑.md` | ✅ | ⬜ pending |
| 01-01-* | 01 | 1 | SC-3 (DB 스키마·와이어프레임) | T-01 | 민감정보(사업자등록번호) 컬럼에 암호화 저장 명시 | file-existence + manual review | `test -f db-schema-design.md && ls wireframes/*.md` | ✅ | ⬜ pending |
| 01-01-* | 01 | 1 | SC-4 (서비스명·도메인) | — | N/A | manual | 해당 없음 | ❌ N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*없음 — 이 Phase는 테스트 프레임워크가 필요하지 않다(코드 없음). Phase 2 실행 시 실제 테스트 인프라(pytest/jest) Wave 0 갭 분석을 별도로 수행해야 한다.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 나라장터 API 4종 활용신청 완료 확인 | SC-1 | 공공데이터포털 로그인이 필요한 외부 시스템 상태 확인이라 자동화 불가 | data.go.kr 마이페이지 > API활용현황에서 4개 서비스가 모두 "승인" 상태인지 확인, 승인 상태 텍스트를 캡처해 STATE.md 또는 phase 산출물에 기록 |
| 업종-물품분류번호 매핑 내용 정확성 | SC-2 | 매핑 파일 존재는 자동 확인 가능하나, 목표 업종 3~5개 각각에 실제로 올바른 물품분류번호가 매핑됐는지는 도메인 판단이 필요 | `업종-물품분류-매핑.md`를 열어 목표 업종 3~5개 각각에 물품분류번호(8자리)가 기입되어 있는지, RESEARCH.md의 `[ASSUMED]` 표기 항목이 재검증됐는지 확인 |
| DB 스키마·와이어프레임 내용 완결성 | SC-3 | 파일 존재는 자동 확인 가능하나 4개 핵심 테이블·4개 화면이 실제로 Phase 2 실행에 쓸 수 있는 수준인지는 사람 판단 필요 | `db-schema-design.md`에 업체 프로필/공고/매칭/알림 4개 테이블이 컬럼·타입과 함께 정의되어 있는지, `wireframes/`에 온보딩·피드·상세·알림설정 4개 화면 명세가 있는지 확인 |
| 도메인 확보 여부 | SC-4 | 결제가 필요한 사용자 액션이라 자동화 불가 | 사용자가 jodalmate.co.kr(또는 대체 도메인) 구매 완료 여부를 직접 보고 |

---

## Validation Sign-Off

- [ ] SC-1: API 4종 활용신청 완료 확인됨
- [ ] SC-2: 업종-물품분류 매핑 문서 존재 및 내용 검토 완료
- [ ] SC-3: DB 스키마·와이어프레임 문서 존재 및 내용 검토 완료
- [ ] SC-4: 서비스명(완료)·도메인(사용자 확인) 확정됨
- [ ] `nyquist_compliant: true` 설정 (전체 Manual-Only 항목 사람 검토 완료 후)

**Approval:** pending
