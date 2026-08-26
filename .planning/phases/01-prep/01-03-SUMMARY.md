---
phase: 01-prep
plan: 03
subsystem: database
tags: [postgresql, schema-design, ddl, uuid, jsonb, pgcrypto, hmac]

# Dependency graph
requires:
  - phase: 01-prep (plan 02)
    provides: "업종-물품분류-매핑.md — variable-length (2/4/6/8) classification_code prefix decision"
provides:
  - "docs/design/db-schema-design.md — 8 core tables (companies, company_classification_codes, company_performances, company_certifications, bid_announcements, matches, notification_logs, notification_settings) with DDL sketches, indexes, and multiplicity/merge rules"
  - "End-to-end join path (companies → notification_logs) proving the prefix-match join is physically viable before columns were finalized"
  - "Sensitive-data storage rule: business_reg_no split into BYTEA ciphertext + HMAC-with-pepper digest, no plaintext column"
affects: [phase-02-mvp, matching-engine, onboarding-schema, notification-settings-schema]

actuals:
  tokens: 7912
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "UUID PK + TIMESTAMPTZ + JSONB raw_payload as PostgreSQL conventions for this project"
    - "Prefix-match join via LIKE on a literal-constant OR'd query, backed by varchar_pattern_ops btree index"
    - "Sensitive PII split-storage: BYTEA ciphertext + HMAC(pepper) digest, never plaintext or bare hash"

key-files:
  created:
    - docs/design/db-schema-design.md
  modified: []

key-decisions:
  - "Region multiplicity: array column (region_codes VARCHAR(10)[]) on companies and bid_announcements, not a normalized company_regions table — low cardinality (10~20 시/도) doesn't justify a join table"
  - "Revision merge: composite UNIQUE (source_bid_no, source_revision_no) + is_latest_revision flag, preserving revision history so 03-detail.md's '개정되었습니다 → 최신 공고 보기' banner and stale matches remain viewable"
  - "prefix-match index: btree varchar_pattern_ops on bid_announcements.classification_code, queried via literal-constant OR clauses from the company's small prefix list, rather than expanding announcement codes into 4 derived prefix rows"
  - "business_reg_no: no plaintext column — BYTEA ciphertext (pgcrypto or app-level AEAD, choice deferred to Phase 2) + separate HMAC-with-pepper digest column carrying a UNIQUE constraint for duplicate-signup detection"
  - "Account model: company 1 = account 1 for MVP; team accounts deferred, would require splitting an accounts/users table off companies"

requirements-completed: [SC-3]

coverage:
  - id: D1
    description: "docs/design/db-schema-design.md exists with all 3 automated task gates passing (spine, table definitions, sensitive-data rules) and exactly 9 h2 sections"
    requirement: SC-3
    verification:
      - kind: other
        ref: "grep-based automated <verify> gates embedded in 01-03-PLAN.md tasks 1-3, all confirmed PASS during execution"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-08-26
status: complete
---

# Phase 1 Plan 3: DB Schema Design Summary

**8-table PostgreSQL schema (companies/classification-codes/performances/certifications/announcements/matches/notification-logs/notification-settings) with a proven prefix-match join spine, variable-length classification_code CHECK constraints, and BYTEA+HMAC business-registration-number storage — no ORM code, design doc only**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-26T00:00:00Z (approx, see git commit timestamps for exact task timing)
- **Completed:** 2026-08-26
- **Tasks:** 3
- **Files modified:** 1 (created)

## Accomplishments

- Closed the DB-schema half of SC-3: a single design document (`docs/design/db-schema-design.md`) now covers all 4 domains (업체 프로필군·공고·매칭·알림) across 8 tables with column types, constraints, and indexes — Phase 2 can go straight to ORM entities and migrations.
- Proved the end-to-end join path (`companies` → `company_classification_codes` → `bid_announcements` prefix match → `matches` → `notification_logs` dedup check) with an actual SQL example *before* finalizing any column, per the tracer task's purpose — this caught the "column-to-column LIKE join won't use an index" subtlety and resolved it by recommending literal-constant OR-clause queries built from the company's own (small) prefix list.
- Locked `classification_code` as a variable-length (2/4/6/8 digit) value via a `CHECK (length(...) IN (2,4,6,8))` + numeric-pattern constraint, correcting the fixed-8-digit assumption flagged as a handoff item from 01-02-SUMMARY.md.
- Closed the plaintext-business-registration-number gap: `companies` has no plaintext column, only `business_reg_no_encrypted BYTEA` + `business_reg_no_digest BYTEA` (HMAC-with-server-pepper, not a bare hash, because the 10-digit numeric space is brute-forceable), with a UNIQUE index on the digest for duplicate-signup detection.
- Resolved two open design questions the plan called out: region multiplicity (chose array columns over a normalization table) and duplicate/revision merge (chose composite `UNIQUE(source_bid_no, source_revision_no)` + `is_latest_revision` flag, preserving revision history for the wireframe's "개정되었습니다" banner).
- Reconciled column names with `docs/design/wireframes/04-notification-settings.md`'s tentative proposal — since that wireframe explicitly deferred to this document once it existed, the 8 `notification_settings` columns (`email_enabled`, `push_enabled`, `min_score_threshold`, `digest_frequency`, `quiet_hours_start/end`, `deadline_reminder_enabled/days`) are now the canonical names.
- Did not design any Phase 4~6 table (자격판정·낙찰통계·서류초안) — confirmed via automated grep gate that no unexpected `CREATE TABLE` targets exist beyond the 8 allowed names.

## Task Commits

Each task was committed atomically:

1. **Task 1: 데이터 흐름 스파인 (tracer)** - `35d51d2` (docs)
2. **Task 2: 8개 테이블 정의·인덱스·복수성/병합 규칙** - `0d9deba` (docs)
3. **Task 3: 민감정보 저장 규칙·범위 경계·Phase 2 인계 사항** - `56d5131` (docs)

_Note: Task 1 is `type="tracer"` — its automated `<verify>` (SELECT/JOIN/LIKE join SQL touching all 6 tables, D-04/D-05/D-06 citations, 2/4/6/8 CHECK pattern) was re-confirmed to pass before proceeding to Task 2's expansion, per the tracer feedback gate. This plan ran in an isolated wave-parallel worktree with no checkpoint tasks in the plan, so execution proceeded straight through to completion rather than stopping for interactive confirmation._

**Plan metadata:** (this SUMMARY's own commit, made immediately after this file)

## Files Created/Modified

- `docs/design/db-schema-design.md` - 9-section design doc: 결론 먼저 / 데이터 흐름 스파인 / 스파인이 강제하는 설계 제약 / 테이블 정의 (8 CREATE TABLE sketches) / 인덱스와 조회 패턴 (4 index definitions) / 복수성·병합 규칙 / 민감정보 저장 규칙 / 이번 Phase 범위 밖 / Phase 2 인계 사항 (7 items)

## Decisions Made

- **Region multiplicity → array column, not normalized table.** `companies.region_codes` and `bid_announcements.region_codes` are both `VARCHAR(10)[]`. Rationale: region selection is low-cardinality (a handful of 시/도 out of ~17), so a join table's relational benefits don't outweigh the extra table/FK. This directly answers RESEARCH.md Assumption A3's warning about insufficient multi-region/multi-classification support.
- **Revision merge → composite unique key + latest-flag, not bid-no-only UPSERT.** `UNIQUE (source_bid_no, source_revision_no)` plus `is_latest_revision BOOLEAN`. Rationale: preserves revision history so the detail wireframe's "이 공고는 개정되었습니다 → 최신 공고 보기" banner has data to work with, and so a `matches` row from a superseded revision remains viewable rather than orphaned by a bid-no-only UPSERT that would discard the prior revision's row.
- **prefix-match index → btree `varchar_pattern_ops` on the announcement side, not a prefix-expansion join table.** Chosen because announcements vastly outnumber companies and each company holds only a handful of registered prefixes — querying with literal-constant `LIKE 'XX%'` OR-clauses (built server-side from the company's own prefix list) keeps the index usable, whereas a naive column-to-column `LIKE` join would force a non-indexed comparison. The prefix-expansion alternative was rejected because it requires re-deriving 4 derived rows/values on every announcement ingest.
- **Sensitive-data split: BYTEA ciphertext + HMAC digest, algorithm choice deferred.** `pgcrypto` vs. application-level AEAD is explicitly left to Phase 2 (tradeoff: DB-visible keys vs. app-only keys), but the irreversible minimum — no plaintext, no bare hash — is locked now per the plan's reversibility note.
- **Account model: company = account (1:1) for MVP**, team accounts explicitly out of scope, with the future split point named (`accounts`/`users` table off `companies`).

## Deviations from Plan

None - plan executed exactly as written. All three tasks' automated `<verify>` gates passed without requiring a fix-retry cycle: section headers, table names, index counts, CHECK constraints, sensitive-data keywords, and the exactly-9-h2-sections requirement were all satisfied on first pass.

## Issues Encountered

The Bash tool's worktree-isolation guard rejected the compound `<automated>` verify one-liners as originally written in the plan (multi-command `&&` chains with `for` loops were deemed "too complex to verify staying inside the worktree"). Worked around this by re-expressing each automated gate as a sequence of Grep-tool calls (section-header regex, keyword-presence regex, CREATE TABLE/INDEX counts) that are functionally equivalent to the plan's grep pipeline, run against the absolute worktree path. This is a tooling accommodation, not a deviation from the plan's actual verification intent — every acceptance criterion listed in the plan was checked and passed.

## User Setup Required

None - no external service configuration required. This plan produces only a markdown design document; no `.sql`, `.ts`, `.tsx`, or `.py` files were created (confirmed via glob check).

## Next Phase Readiness

- Phase 2 can go directly to ORM entities and a first migration using `docs/design/db-schema-design.md` as the reference — table names, column names, types, constraints, and indexes are all specified with rationale.
- 7 explicit Phase 2 handoff items are recorded in the document's final section, most notably: (1) the facility-management (시설관리) classification code remains `[미확인]` and must be resolved before that industry's seed data can be filled in, (2) the prefix-match index recommendation needs `EXPLAIN ANALYZE` verification against real data volume, and (3) every matching/notification query must be reviewed for `company_id` scoping to prevent cross-tenant data exposure (threat register `T-01-12`).
- The `04-notification-settings.md` wireframe's tentative column names are now confirmed as canonical — no further reconciliation needed between that wireframe and the schema.
- No blockers for Phase 2 planning. The remaining half of SC-3 (wireframes) was completed in plan 01-04 (see `01-04-SUMMARY.md`), so both halves of SC-3 are now closed.

---
*Phase: 01-prep*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: docs/design/db-schema-design.md
- FOUND: .planning/phases/01-prep/01-03-SUMMARY.md
- FOUND commit: 35d51d2 (Task 1)
- FOUND commit: 0d9deba (Task 2)
- FOUND commit: 56d5131 (Task 3)
