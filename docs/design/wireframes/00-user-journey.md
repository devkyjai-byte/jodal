> 이 문서는 설계 참고 문서이며 실행 코드가 아니다. 시각 목업이 아닌 텍스트 명세다.

# 핵심 사용자 여정 — 가입에서 첫 알림 조정까지

## 이 문서의 위치

`D-09`(와이어프레임은 실제 시각 목업이 아니라 화면별 컴포넌트·레이아웃·상호작용을 정리한 텍스트 명세로 남긴다)에 따라 이 디렉터리(`docs/design/wireframes/`)의 모든 문서는 HTML 목업이나 이미지가 아닌 마크다운 텍스트 명세다. `D-10`에 따라 이번 Phase가 다루는 화면은 MVP 핵심 4개로 고정되며, 자격판정 배지·낙찰통계 대시보드·AI 서류작성 화면은 이 범위에 포함되지 않는다. 4개 화면 파일은 다음과 같다.

- [01-onboarding.md](./01-onboarding.md) — 온보딩 / 업체 프로필 등록
- [02-feed.md](./02-feed.md) — 공고 피드 (매칭된 공고 목록)
- [03-detail.md](./03-detail.md) — 공고 상세
- [04-notification-settings.md](./04-notification-settings.md) — 알림 설정

이 문서(`00-user-journey.md`) 자신은 화면 명세가 아니다 — 위 4개 화면을 하나의 경로로 꿰는 여정·인계 문서다.

## 핵심 여정 (한 사람, 한 경로)

시나리오: 정보통신 업종의 소규모 업체 담당자 1명이 조달메이트에 처음 가입해 첫 매칭 알림을 받고, 그 공고를 확인한 뒤 알림 강도를 조정한다. 이 경로는 `CLIENT-05`(온보딩 완주·이탈 방지)가 성립하는지 확인하는 최소 단위이며, 분기 없이 단 하나의 경로만 서술한다.

### ① 가입·업체 프로필 등록

- **화면:** `01-onboarding.md`
- **사용자 행동:** 사업자등록번호·업체명·이메일을 입력하고 개인정보 수집·이용에 동의한다. 업종 선택 스텝에서 물품분류 대분류 "43(정보기술방송통신)" 1개만 선택하고 중분류는 펼치지 않는다. 활동 지역은 "서울특별시" 1개만 선택한다. 실적·인증 스텝은 건너뛴다. 알림 채널은 기본값(이메일 on)을 그대로 둔 채 등록을 완료한다.
- **시스템 반응:** `companies`에 계정을 생성하고, `company_classification_codes`에 대분류 prefix `43`을 저장하며, `notification_settings`에 이메일 채널 on을 기본값으로 기록한다. 진위확인(PROF-05)은 비동기로 진행되며 등록 자체는 막지 않는다.
- **다음 단계로 넘기는 값:** 로그인 세션에 `company_id`, 등록된 업종 prefix(`43`), 활동 지역(`서울특별시`)이 저장된다 — 이 값이 ②의 첫 매칭 스코프가 된다.

### ② 첫 매칭 이메일 알림 수신

- **화면:** 화면 밖(이메일 클라이언트) — 조달메이트 화면이 아니라 이메일이 매개체다.
- **사용자 행동:** 수신함에서 "회원님 조건에 맞는 공고가 등록되었습니다" 메일을 열어 확인한다.
- **시스템 반응:** 서버가 `43` prefix로 시작하는 신규 공고를 `matches`에 기록하고, `notification_logs`에 이메일 발송 이력을 `sent` 상태로 남긴다. 메일 본문에는 공고명·마감일·상세 진입 링크가 포함된다.
- **다음 단계로 넘기는 값:** 메일의 상세 링크에 공고 식별자(`announcement_id`)와 매칭 식별자(`match_id`)가 URL 파라미터로 담겨 있다.

### ③ 알림 링크로 공고 상세 진입, 나라장터 원문으로 대조

- **화면:** `03-detail.md`
- **사용자 행동:** 메일의 링크를 클릭해 상세 화면에 진입하고, 상단의 나라장터 원문 링크를 눌러 원문과 파싱 결과를 대조한다.
- **시스템 반응:** URL의 `announcement_id`로 `bid_announcements`를 읽고, `match_id`로 `matches`에서 이 업체의 매칭 근거(일치한 prefix `43`, 지역 일치 여부)를 읽어 화면에 표시한다. 원문 링크는 별도 인증 없이 나라장터 원문 페이지로 이동한다.
- **다음 단계로 넘기는 값:** "이 업종 알림 조정하기" 액션을 누르면, 이 공고가 속한 업종 맥락("정보통신 관련 알림이 너무 많다고 느낌")이 다음 화면으로 전달된다.

### ④ 알림이 너무 많다고 느껴 적합도 임계값을 올림

- **화면:** `04-notification-settings.md`
- **사용자 행동:** 상세 화면에서 넘어온 채로 적합도 임계값 슬라이더를 현재보다 높은 값으로 조정한다.
- **시스템 반응:** `notification_settings`의 임계값 컬럼을 즉시 갱신하고, "이 값 이상만 알림을 보낸다"는 트레이드오프 안내(알림이 줄고 놓칠 위험이 커짐)를 표시한다.
- **다음 단계로 넘기는 값:** 없음 — 이 여정의 마지막 단계다. 이후 알림부터 새 임계값이 적용된다.

분기·예외·에러(마감된 공고, 매칭 0건, 진위확인 실패 등)는 이 문서에서 다루지 않고 각 화면 문서의 §엣지 케이스로 미룬다.

## 화면 간 데이터 인계 계약

| 출발 지점 | 도착 화면 | 넘기는 값 | 도착 화면이 그 값으로 무엇을 조회하는가 |
|---|---|---|---|
| 온보딩 (`01-onboarding.md`) | 피드 (`02-feed.md`) | 등록된 업종 prefix·활동 지역 — **세션에서 꺼내는 값** (URL에 노출되지 않음, 로그인 세션의 `company_id`로 매번 재조회) | `matches`를 이 업체 범위로 조회할 때 필터 기본값으로 사용 (`company_classification_codes`, `companies.region_code` 조인) |
| 이메일 알림 | 상세 (`03-detail.md`) | 공고 식별자(`announcement_id`)·매칭 식별자(`match_id`) — **URL 파라미터로 노출** (메일 링크 쿼리스트링) | `bid_announcements`를 공고 식별자로, `matches`를 매칭 식별자로 조회해 상세 정보와 매칭 근거를 표시 |
| 피드 (`02-feed.md`) | 상세 (`03-detail.md`) | 공고 식별자(`announcement_id`) — **URL 파라미터로 노출** (카드 클릭 시 경로에 포함) | `bid_announcements`를 공고 식별자로 읽고, `matches`는 URL의 `match_id` 없이 세션의 `company_id`+`announcement_id` 조합으로 재조회 |
| 상세 (`03-detail.md`) | 알림 설정 (`04-notification-settings.md`) | 어떤 알림이 과했는지 맥락(진입 출처 공고의 업종 prefix) — **URL 파라미터로 노출** (`?from=detail&hint=43`류의 쿼리) — 실제 설정 변경 대상 행 자체는 **세션에서 꺼내는 값**(`company_id`)으로 `notification_settings`를 조회 | 어느 설정 항목(임계값)을 화면 진입 시 강조·안내할지 결정, 실제 읽기·쓰기는 세션의 `company_id`로 `notification_settings` 조회 |

## 화면별 읽기·쓰기 테이블

| 화면 | 읽는 테이블 | 쓰는 테이블 | 관련 요구사항 ID |
|---|---|---|---|
| 01-onboarding.md | `companies`(사업자등록번호 중복 체크) | `companies`, `company_classification_codes`, `company_performances`, `company_certifications`, `notification_settings` | PROF-01~05, CLIENT-05 |
| 02-feed.md | `matches`, `bid_announcements`, `companies`(세션 스코프) | 없음 (필터·정렬 상태는 화면 로컬 상태, 영속 저장 없음) | ING-04, MATCH-01, CLIENT-01 |
| 03-detail.md | `bid_announcements`, `matches` | 없음 (이 Phase 범위에서는 "저장/관심 표시" 액션의 저장 테이블을 확정하지 않음 — Phase 2에서 결정) | ING-02, ING-03, MATCH-02 |
| 04-notification-settings.md | `notification_settings`, `notification_logs`(읽기 전용 이력) | `notification_settings` | MATCH-02, MATCH-03 |

`docs/design/db-schema-design.md`(플랜 03 산출물)가 이미 존재하면 그 문서의 테이블·컬럼명을 우선 인용해야 한다 — 이 문서 작성 시점에는 플랜 03이 아직 완료되지 않아, 위 표준 테이블 이름(`companies`, `company_classification_codes`, `company_performances`, `company_certifications`, `bid_announcements`, `matches`, `notification_logs`, `notification_settings`)은 `01-RESEARCH.md`의 스키마 스케치를 그대로 사용했다. 차이가 발생하면 각 화면 문서의 §데이터 소스에서 각주로 정정한다.

## 여정이 끊기는 지점

- **프로필은 등록했는데 매칭 결과가 0건인 경우** — 담당 화면: `02-feed.md`. 등록한 prefix가 너무 좁거나 최근 해당 업종 공고가 없는 경우이며, 피드 화면이 "업종 선택을 넓히도록 안내 + 온보딩으로 돌아가는 링크"를 §엣지 케이스에서 처리한다.
- **알림 링크로 들어온 공고가 이미 마감됐거나 개정된 경우** — 담당 화면: `03-detail.md`. 상세 화면이 마감 표시와, 개정된 경우 최신 차수로 이동하는 안내를 §엣지 케이스에서 처리한다.
- **사용자가 모든 알림 채널을 끈 경우** — 담당 화면: `04-notification-settings.md`. 이메일·푸시를 모두 off로 두면 "원하는 조달 공고를 놓치지 않는다"는 핵심 가치 자체가 성립하지 않게 되는 지점이므로, 알림 설정 화면이 §엣지 케이스에서 경고와 함께 확인을 받는 절차를 둔다.
