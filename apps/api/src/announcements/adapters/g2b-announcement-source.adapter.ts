import { Logger } from '@nestjs/common';
import type {
  AnnouncementSourcePort,
  RawAnnouncement,
} from '../ports/announcement-source.port';

/**
 * 나라장터 입찰공고정보서비스(data.go.kr) 엔드포인트.
 * [ASSUMED] 정확한 엔드포인트 경로·응답 필드명은 활용신청 승인 후 실제 Swagger 문서로
 * 재확인이 필요하다 — 02-RESEARCH.md Open Question 2, Assumption A3.
 */
const NARAJANGTEO_BID_ANNOUNCEMENT_ENDPOINT =
  'http://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServc';

/**
 * [ASSUMED] 나라장터 응답 필드명 — 공개된 유사 사례(2차 출처) 패턴을 참고했으며 원문
 * Swagger 문서로 검증되지 않았다(RESEARCH.md §Sources Tertiary). 실제 필드명이 다르면
 * parseItem()의 매핑만 수정하면 되고, 이 어댑터의 나머지 구조(fetch → 개별 파싱 → 실패
 * 격리)는 그대로 유지된다.
 */
interface NarajangteoApiItem {
  bidNtceNo?: string;
  bidNtceOrd?: string | number;
  bidNtceNm?: string;
  dminsttNm?: string;
  prdctClsfcNo?: string;
  presmptPrce?: string | number;
  bidBeginDt?: string;
  bidClseDt?: string;
  [key: string]: unknown;
}

interface NarajangteoApiResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { items?: NarajangteoApiItem[]; totalCount?: number };
  };
}

/**
 * 실제 나라장터 API를 Node 내장 fetch로 호출하는 완전한 프로덕션 구현.
 * ANNOUNCEMENT_SOURCE=g2b로 전환하기 전까지는 절대 호출되지 않는다(팩토리 프로바이더가
 * 선택하지 않음). NARAJANGTEO_API_KEY 환경변수가 없으면 호출을 시도하지 않고 빈 배열을
 * 반환해 배치 잡 전체를 실패시키지 않는다.
 *
 * 응답 필드명이 미확인 상태이므로(§Phase 1 인계), 레코드 단위 파싱 실패는 개별적으로
 * 로그만 남기고 나머지 레코드 처리를 막지 않는다 — 이 어댑터가 지켜야 할 핵심 요구사항.
 */
export class G2BAnnouncementSourceAdapter implements AnnouncementSourcePort {
  private readonly logger = new Logger(G2BAnnouncementSourceAdapter.name);

  constructor(private readonly apiKey: string) {}

  async fetchLatest(): Promise<RawAnnouncement[]> {
    if (!this.apiKey) {
      this.logger.error(
        'NARAJANGTEO_API_KEY가 설정되지 않았습니다. ANNOUNCEMENT_SOURCE=g2b를 쓰려면 이 값이 필요합니다 — 이번 폴링은 건너뜁니다.',
      );
      return [];
    }

    const url = new URL(NARAJANGTEO_BID_ANNOUNCEMENT_ENDPOINT);
    url.searchParams.set('serviceKey', this.apiKey);
    url.searchParams.set('type', 'json');
    url.searchParams.set('numOfRows', '100');
    url.searchParams.set('pageNo', '1');

    let response: Response;
    try {
      response = await fetch(url.toString());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`나라장터 API 네트워크 호출 실패: ${message}`);
      return [];
    }

    if (!response.ok) {
      this.logger.error(
        `나라장터 입찰공고정보서비스 호출 실패: HTTP ${response.status}`,
      );
      return [];
    }

    const payload = (await response.json()) as NarajangteoApiResponse;
    const resultCode = payload.response?.header?.resultCode;
    if (resultCode !== undefined && resultCode !== '00') {
      this.logger.error(
        `나라장터 API 오류 응답: ${resultCode} ${payload.response?.header?.resultMsg ?? ''}`,
      );
      return [];
    }

    const items = payload.response?.body?.items ?? [];
    const results: RawAnnouncement[] = [];
    for (const item of items) {
      try {
        results.push(this.parseItem(item));
      } catch (err) {
        // 개별 레코드 파싱 실패는 로그만 남기고 나머지 레코드 처리를 막지 않는다
        // (§Phase 1 인계 사항 — 필드명 미확인 상태에서의 방어 요구사항).
        const message = err instanceof Error ? err.message : 'unknown error';
        this.logger.error(
          `나라장터 응답 레코드 파싱 실패(개별 스킵): ${message}`,
        );
      }
    }
    return results;
  }

  private parseItem(item: NarajangteoApiItem): RawAnnouncement {
    if (!item.bidNtceNo) {
      throw new Error('bidNtceNo(공고번호) 필드 누락');
    }
    return {
      sourceBidNo: item.bidNtceNo,
      sourceRevisionNo: item.bidNtceOrd ?? '0',
      title: item.bidNtceNm ?? '(제목 없음)',
      classificationCode: item.prdctClsfcNo ?? null,
      // 나라장터 응답의 참가가능지역 필드는 [ASSUMED] 상태 — 확정 전까지 빈 배열(전국 취급).
      regionCodes: [],
      agencyName: item.dminsttNm ?? null,
      budgetAmount: item.presmptPrce ?? null,
      bidOpenAt: item.bidBeginDt ?? null,
      bidCloseAt: item.bidClseDt ?? null,
      raw: item,
    };
  }
}
