/**
 * 나라장터 공고 수집원 추상화 — 02-05-PLAN.md objective의 핵심 요구사항.
 * 실제 나라장터 API가 승인되기 전에는 FixtureAnnouncementSourceAdapter가 이 포트를 구현해
 * 지금 당장 배치 수집 파이프라인 전체(정규화·개정 병합·팬아웃 재매칭)를 검증 가능하게 하고,
 * 승인 후에는 ANNOUNCEMENT_SOURCE=g2b 환경변수 전환만으로 G2BAnnouncementSourceAdapter가
 * 활성화된다 — 코드 재작성이 없다.
 */

/**
 * 수집원이 반환하는 "정규화 이전" 원문 형태.
 * 실제 API 응답 필드는 활용신청 승인 전까지 미확인이므로(01-VERIFICATION.md human_needed),
 * 각 필드는 방어적으로 느슨한 타입을 허용한다 — 실제 정규화·검증은
 * AnnouncementsService.pollAndUpsert()가 담당한다.
 */
export interface RawAnnouncement {
  /** 나라장터 공고번호 */
  sourceBidNo: string;
  /**
   * 개정 차수. 빈 문자열/누락/숫자 세 가지 형태 모두 올 수 있다(§Phase 2 인계 사항 3,
   * 미확인) — AnnouncementsService가 이 값을 '0' 기본값 포함 문자열로 정규화한다.
   */
  sourceRevisionNo?: string | number | null;
  title: string;
  /** 물품분류번호. 파싱 실패 시 NULL 허용(db-schema-design.md §스파인이 강제하는 설계 제약 (c)) */
  classificationCode?: string | null;
  regionCodes?: string[] | null;
  agencyName?: string | null;
  budgetAmount?: string | number | null;
  bidOpenAt?: string | null;
  bidCloseAt?: string | null;
  /** 원문 전체 — raw_payload(JSONB)에 그대로 보관되어 재파싱에 대비한다 */
  raw: Record<string, unknown>;
}

export interface AnnouncementSourcePort {
  fetchLatest(): Promise<RawAnnouncement[]>;
}

export const ANNOUNCEMENT_SOURCE_PORT = Symbol('ANNOUNCEMENT_SOURCE_PORT');
