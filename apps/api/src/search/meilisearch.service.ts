import { Injectable, Logger } from '@nestjs/common';
import { Meilisearch } from 'meilisearch';

/**
 * ING-04 검색 색인. 02-06 checkpoint:decision 확정값(meilisearch)의 구현체.
 * 클라이언트(apps/web)는 이 서비스를 직접 호출하지 않는다 — 반드시 NestJS API를
 * 경유하며, 마스터키는 서버 환경변수에만 존재한다(T-02-14, RESEARCH.md §Standard Stack).
 */
export const ANNOUNCEMENTS_INDEX_UID = 'bid_announcements';

export interface AnnouncementSearchRecord {
  id: string;
  title: string;
  agencyName: string | null;
  classificationCode: string | null;
  regionCodes: string[];
  /** epoch seconds — Meilisearch 정렬 가능 필드는 문자열 날짜보다 숫자가 안전하다. */
  bidCloseAt: number | null;
}

interface MeiliSearchHit {
  id: string;
}

@Injectable()
export class MeilisearchService {
  private readonly logger = new Logger(MeilisearchService.name);
  private readonly client: Meilisearch;

  constructor() {
    this.client = new Meilisearch({
      host: process.env.MEILI_HOST ?? 'http://localhost:7700',
      apiKey: process.env.MEILI_MASTER_KEY,
    });
  }

  /**
   * 공고 1건을 색인에 upsert한다. title/agency_name/classification_code/region_codes/
   * bid_close_at 필드를 색인(플랜 지시). 색인 실패가 배치 수집(pollAndUpsert) 전체를
   * 막지 않도록 이 메서드 내부에서 에러를 흡수한다 — 검색은 부가 기능이지 수집 파이프라인의
   * 필수 경로가 아니다(AnnouncementsService.upsertOne의 개별 레코드 격리 원칙과 동일).
   */
  async indexAnnouncement(record: AnnouncementSearchRecord): Promise<void> {
    try {
      await this.client
        .index(ANNOUNCEMENTS_INDEX_UID)
        .addDocuments([record], { primaryKey: 'id' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(
        `Meilisearch 색인 실패(id=${record.id}, 개별 스킵): ${message}`,
      );
    }
  }

  /**
   * 키워드로 후보 announcement_id 목록을 조회한다. GET /feed가 이 id 목록을
   * matches 조인의 교집합 조건으로 사용한다(announcements.service.ts#getFeed).
   * Meilisearch 연결 실패 시 빈 배열을 반환한다 — 검색엔진 장애가 피드 전체를
   * 500으로 만들지 않도록 방어한다(호출부가 빈 배열을 "결과 없음"으로 취급).
   */
  async searchAnnouncementIds(keyword: string): Promise<string[]> {
    try {
      const result = await this.client
        .index(ANNOUNCEMENTS_INDEX_UID)
        .search(keyword, {
          limit: 1000,
          attributesToRetrieve: ['id'],
        });
      return (result.hits as MeiliSearchHit[]).map((hit) => hit.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(
        `Meilisearch 검색 실패(keyword="${keyword}"): ${message}`,
      );
      return [];
    }
  }
}
