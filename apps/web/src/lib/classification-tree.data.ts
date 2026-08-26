/**
 * 목표 업종 4개 추천 트리 데이터 — docs/design/업종-물품분류-매핑.md §목표 업종 매핑표를
 * 그대로 반영한다. UNSPSC 전체 42개 세그먼트 매핑은 이번 Phase 범위 밖이다
 * (D-08/§이번 Phase 범위 밖 (b), 02-04-PLAN.md).
 *
 * `confirmed: false`(시설관리)는 물품분류번호가 아직 확정되지 않았다는 뜻이다
 * (§미확인 항목과 확인 방법 1번) — 온보딩 UI는 이 항목을 "코드 확인 중" 배지로 표시하고
 * 선택 대신 사용자가 직접 코드를 입력하게 유도한다.
 */

export interface ClassificationMidCategory {
  /** 4자리 중분류 코드 */
  code: string;
  name: string;
}

export interface ClassificationCategory {
  /** 2자리 대분류 코드. confirmed=false면 빈 문자열(코드 미확정). */
  code: string;
  name: string;
  /** 물품분류번호가 실제 확인된 항목인지 (§목표 업종 매핑표 검증 상태) */
  confirmed: boolean;
  midCategories: ClassificationMidCategory[];
}

export const RECOMMENDED_CLASSIFICATION_TREE: ClassificationCategory[] = [
  {
    code: '43',
    name: '정보통신·소프트웨어개발',
    confirmed: true,
    midCategories: [{ code: '4321', name: '컴퓨터 본체·주변기기' }],
  },
  {
    code: '44',
    name: '사무용품',
    confirmed: true,
    midCategories: [{ code: '4412', name: '사무용 소모품·잡화류' }],
  },
  {
    code: '55',
    name: '인쇄·출판',
    confirmed: true,
    midCategories: [{ code: '5510', name: '인쇄·출판물류' }],
  },
  {
    code: '',
    name: '시설관리',
    confirmed: false,
    midCategories: [],
  },
];
