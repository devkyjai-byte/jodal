---
phase: 01-prep
reviewed: 2026-08-25T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - docs/design/api-신청-체크리스트.md
  - docs/design/도메인-서비스명-체크리스트.md
  - docs/design/업종-물품분류-매핑.md
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 01-prep: Code Review Report

**Reviewed:** 2026-08-25
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 1 is documentation-only (per `01-01-PLAN.md`/`01-02-PLAN.md`), so this review focused on internal/cross-document factual consistency, leaked-credential patterns, and structural compliance with the plans rather than code correctness. No secrets, dangerous patterns, or debug artifacts were found (`grep` for key/token/password patterns and 32+ char tokens turned up nothing beyond a markdown table divider). All required sections, decision-ID citations, and dataset IDs specified in `01-01-PLAN.md`/`01-02-PLAN.md` are present and verified against `01-RESEARCH.md`, `01-CONTEXT.md`, and `ROADMAP.md`.

However, three consistency/accuracy defects were found that could actively mislead the Phase 2 planner or the user filling in these checklists: a self-contradictory domain-ranking table, a technically incorrect claim about PostgreSQL `VARCHAR(8)` semantics that undermines the schema recommendation it's attached to, and PWA-manifest hand-off items tagged to the wrong phase (Phase 3 instead of Phase 2, per ROADMAP.md's own Phase 2 success criteria). None of these are blockers since no code executes yet, but all three should be fixed before Phase 2 planning consumes these documents as ground truth.

## Warnings

### WR-01: Domain candidate table assigns the same rank to three different-priority items, one of which contradicts its own rank label

**File:** `docs/design/도메인-서비스명-체크리스트.md:20-25`
**Issue:** The "도메인 방침" table lists `jodalmate.kr`, `jodal-mate.co.kr`, and `jodalmate.com` all under `순위 = 2순위`. The `jodalmate.com` row's own 비고 text then explicitly calls it "최후순위" (last priority) — directly contradicting its table-assigned rank of "2순위" (tied for second, same as the other two). A reader (or the user filling in "확정 결과") cannot tell from the table alone whether `jodalmate.com` should be tried before or after `jodalmate.kr`/`jodal-mate.co.kr`, since the rank column says they're equal while the prose says otherwise.
**Fix:** Use distinct sequential ranks (2순위/3순위/4순위) that match the prose ordering, e.g.:
```markdown
| 순위 | 도메인 후보 | 비고 |
|------|-------------|------|
| 1순위 | `jodalmate.co.kr` | 서비스명(Jodalmate) + `.co.kr` 조합, 국내 B2B 신뢰도 최우선 |
| 2순위 | `jodalmate.kr` | `.co.kr` 등록 불가 시 대체 — 짧고 동일 어근 유지 |
| 3순위 | `jodal-mate.co.kr` | 하이픈 포함 변형 — 근접 대체 |
| 4순위 | `jodalmate.com` | 국제형 대체 — 국내 B2B 신뢰도 우선순위(D-02)와 맞지 않아 최후순위 |
```

### WR-02: Schema recommendation mislabels `VARCHAR(8)` as "fixed-length" and then re-recommends the same type as the "fix"

**File:** `docs/design/업종-물품분류-매핑.md:68`
**Issue:** The text states: "RESEARCH.md 초안 스키마 스케치의 `classification_code VARCHAR(8)` 같은 **고정 8자리 컬럼은 부적절**하며, 가변 길이(`VARCHAR(8)` 최대 길이는 유지하되 짧은 값도 허용) ... 이 필요하다." This is factually wrong and self-contradictory: PostgreSQL `VARCHAR(n)` is already a variable-length type (unlike `CHAR(n)`, which pads to fixed length) — it natively stores 2/4/6/8-character prefix strings without any change. The document criticizes `VARCHAR(8)` as "fixed 8-digit" and then proposes "VARCHAR(8) but allow shorter values" as the corrective measure, which is the identical type it just condemned. A Phase 2 schema author reading this literally could either (a) waste time "fixing" a non-problem, or (b) mistakenly swap in `CHAR(8)` believing that's what was meant by "fixed," which would actually introduce the padding bug this section is trying to avoid.
**Fix:** Correct the reasoning — the real requirement is not about `VARCHAR` vs. fixed-length, but about *not assuming every stored value is exactly 8 digits* when writing matching logic:
```markdown
RESEARCH.md 초안 스키마의 `classification_code VARCHAR(8)` 컬럼 타입 자체는 문제가 없다 —
PostgreSQL VARCHAR(n)은 이미 가변 길이이므로 2/4/6/8자리 값을 그대로 저장할 수 있다.
다만 애플리케이션·쿼리 레벨에서 "저장된 값이 항상 8자리"라고 가정하면 안 되며,
prefix 매칭(`LIKE company_code || '%'`)으로 다양한 자릿수를 다뤄야 한다.
```

### WR-03: PWA manifest hand-off items are tagged Phase 3, but ROADMAP.md places the Next.js PWA delivery in Phase 2

**File:** `docs/design/도메인-서비스명-체크리스트.md:12, 51`
**Issue:** Both mentions of the PWA manifest (`name`/`short_name` at line 12, `start_url`/`scope` at line 51) are tagged `(Phase 3)`. But `.planning/ROADMAP.md` Phase 2 Success Criteria #4 explicitly states "사용자는 웹(Next.js PWA)에서 공고를 ... 검색·필터링해 볼 수 있다" — the PWA (and therefore its manifest) is a Phase 2 deliverable. Phase 3 is "모바일 스토어 출시" via Capacitor wrapping the *already-existing* PWA, not the PWA's first build. Since Phase 1's own SC-4 requires the domain to be confirmed before Phase 2 begins (Phase 2 `depends_on: Phase 1`), the manifest should be populated with the real domain/name during Phase 2, not deferred to Phase 3. As written, a Phase 2 implementer following this checklist could ship the Phase 2 PWA with a placeholder manifest name, requiring avoidable rework in Phase 3.
**Fix:** Re-tag both bullets to Phase 2:
```markdown
- PWA manifest의 `name` / `short_name` 필드(Phase 2 — Next.js PWA 최초 빌드 시점)
...
- PWA manifest의 `start_url` / `scope` (Phase 2)
```

## Info

### IN-01: Design doc's derived UNSPSC example codes are not reconciled against the conflicting example already in RESEARCH.md

**File:** `docs/design/업종-물품분류-매핑.md:29`
**Issue:** The document lists `43211501`(데스크톱 컴퓨터)/`43211502`(노트북 컴퓨터)/`43211817`(복합기), sourced from a NETBID guide and explicitly flagged `[미확인]`/재검증 필요 in item 2 of "미확인 항목과 확인 방법" — which is good practice. However, `01-RESEARCH.md` (the document's own stated input) contains a different example for the same real-world item at two separate points: line 44 says `43211507=노트북컴퓨터` and line 92 says `43211507 = 윈도우 기반 데스크탑 PC` (RESEARCH.md is internally inconsistent about what `43211507` even represents). The design doc silently uses yet a third, different code for 노트북컴퓨터 (`43211502`) without flagging that its source material disagrees with itself, or noting the conflict for whoever verifies these values in Phase 2.
**Fix:** Add a one-line cross-reference in the "미확인 항목과 확인 방법" §2 entry noting that RESEARCH.md itself cites a conflicting code (`43211507`) for the same item, so the Phase 2 verifier knows there are two unreconciled candidate values to check against `goods.g2b.go.kr`, not just one.

### IN-02: One representative "대표 중분류·소분류 예시" value doesn't match all three listed 8-digit examples in the same row

**File:** `docs/design/업종-물품분류-매핑.md:29`
**Issue:** The row's "대표 중분류·소분류 예시" column states `4321(컴퓨터장비류) - 15(컴퓨터본체·주변기기 소분류)`, i.e., Class = `15`. But the adjacent "대표 8자리 품명분류 예시" column includes `43211817`(복합기), whose Class digits are `18`, not `15`. Two of the three examples (`43211501`, `43211502`) do match Class `15`; the third does not, and the mismatch isn't called out.
**Fix:** Either add a second class-level example (`4321-18: 복합기·주변기기류`) to the "대표 중분류·소분류" column, or drop `43211817` from the 8-digit example list to keep the row internally consistent.

### IN-03: "확정 결과" table leaves 확정일 blank for a decision (D-01 서비스명) the plan instructed to be filled in

**File:** `docs/design/도메인-서비스명-체크리스트.md:36-44`
**Issue:** `01-01-PLAN.md` Task 2 action item 4 specifies the 서비스명 row should have "확정일 기입" (fill in the confirmation date), since D-01 was already decided in this session. The produced table leaves the 확정일 column empty for every row, including 서비스명, even though the document's own §서비스명 (확정) section states this decision requires "추가 사용자 액션이 필요하지 않다" (already final). Leaving 확정일 blank for an already-final decision is a minor completeness gap versus the plan's literal instruction.
**Fix:** Fill in the session/document date (e.g., the same date used in `업종-물품분류-매핑.md`'s footer, `2026-08-25`) for the 서비스명 and 영문명 rows, since those two are already decided and don't require further user action.

---

_Reviewed: 2026-08-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
