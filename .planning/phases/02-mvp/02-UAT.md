---
status: testing
phase: 02-mvp
source: [02-VERIFICATION.md]
started: 2026-08-27T05:00:00.000Z
updated: 2026-08-27T05:00:00.000Z
---

## Current Test

number: 1
name: 회원가입→온보딩 5스텝→피드→상세→알림설정을 실제 브라우저로 클릭해 끝까지 완주한다
expected: |
  콘솔 오류 없이 각 화면이 렌더링되고 /feed에 도달한다
awaiting: user response

## Tests

### 1. 회원가입→온보딩 5스텝→피드→상세→알림설정을 실제 브라우저로 클릭해 끝까지 완주한다
expected: 콘솔 오류 없이 각 화면이 렌더링되고 /feed에 도달한다
result: [pending]

### 2. 공고 상세 화면에서 나라장터 원문 링크가 스크롤 없이(above-the-fold) 보이는지 확인
expected: 헤더 바로 아래 원문 링크 버튼이 뷰포트 안에 고정 노출된다
result: [pending]

### 3. 브라우저에서 네트워크를 끊고 /feed를 재방문해 오프라인 캐시 폴백과 배지가 표시되는지 확인
expected: 마지막으로 불러온 피드가 캐시에서 표시되고 '오프라인' 배지가 노출된다
result: [pending]

### 4. 웹 푸시 구독 버튼 클릭 → 브라우저 권한 요청 → 구독 생성 → 신규 매칭 시 실제 브라우저 알림 수신
expected: 권한 허용 시 POST /push-subscriptions 호출, 신규 매칭 발생 시 브라우저 알림 표시, 클릭 시 상세로 이동
result: [pending]

### 5. 알림 설정 화면에서 이메일·푸시를 모두 끄면 확인 다이얼로그가 뜨고, 확인 후 경고 배너가 지속 노출되는지 확인
expected: 확인 없이는 PATCH가 전송되지 않고, 확인 후 '모든 알림이 꺼져 있습니다' 배너가 노출된다
result: [pending]

### 6. 사업자등록번호를 입력해 가입 페이지를 나갔다가 재방문 시 앞 3자리만 마스킹되어 표시되는지 확인
expected: 123-**-***** 형태로 마스킹된 읽기전용 필드가 표시된다
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
