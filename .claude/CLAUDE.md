<!-- GSD:project-start source:PROJECT.md -->

## Project

**조달메이트**

조달청 나라장터 공고를 업체 프로필(업종코드·지역·실적·보유인증)과 자동으로 매칭해, "받고 싶은 조달"을 놓치지 않게 돕는 서비스. 1인 개발로 웹+모바일을 동시에 출시하는 것을 목표로 한다.

**Core Value:** 원하는 조달 공고를 놓치지 않는다 — 맞춤 매칭·알림 기능 하나만으로도 이 가치는 성립한다.

### Constraints

- **Team**: 1인 개발 — 기능 범위와 일정은 항상 이 제약을 우선 반영
- **Tech stack**: Next.js+TypeScript(PWA) / Capacitor(모바일 래핑) / NestJS 또는 FastAPI(백엔드) / PostgreSQL / Meilisearch 또는 OpenSearch(검색) / Redis+BullMQ(큐·스케줄러) — 러닝커브·운영부담이 적은 조합 우선
- **Timeline**: MVP(매칭·알림) 3~4개월, 전체 4개 기능 완성 7~8개월
- **Legal**: 이용약관에 "정보 제공·보조 도구"임을 명시, 낙찰 보장 등의 표현 금지. 사업자등록번호 등 민감정보는 개인정보보호법·정보통신망법 준수 및 암호화 저장 필수
- **API 한도**: 공공데이터포털 API 일일 호출 한도 존재 — 캐싱 전략 또는 한도 상향 신청 필요
- **인프라**: 공공데이터 연동 특성상 국내 리전(Naver Cloud Platform 또는 AWS 서울 리전) 우선 고려

<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->

## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
