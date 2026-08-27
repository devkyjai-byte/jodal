import { Logger } from '@nestjs/common';
import type {
  AnnouncementSourcePort,
  RawAnnouncement,
} from '../ports/announcement-source.port';

/**
 * 나라장터 입찰공고정보서비스(data.go.kr) 엔드포인트.
 * 실제 승인된 서비스키로 라이브 검증 완료(2026-08-27) — 더 이상 [ASSUMED]가 아니다.
 */
const NARAJANGTEO_BID_ANNOUNCEMENT_ENDPOINT =
  'http://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServc';

/**
 * 조회 기간 범위(일). 라이브 검증 결과 1년 범위는 "입력범위값 초과 에러"(resultCode 07)를
 * 반환했고, 1개월 범위는 정상 응답했다 — 이 서비스의 inqryBgnDt/inqryEndDt는 최대 1개월
 * 창으로 제한된다. 매 폴링마다 "최근 N일 ~ 지금"을 조회하고 upsert가 멱등하게 처리하므로
 * 폴링 주기(INGEST_CRON_PATTERN, 기본 4시간)보다 넉넉하게 30일로 잡아 누락을 방지한다.
 */
const INQUIRY_WINDOW_DAYS = 30;

/**
 * 나라장터 응답 필드명 — 실제 승인된 서비스키로 라이브 검증 완료(2026-08-27).
 * `prdctClsfcNo`(물품분류번호)는 이 엔드포인트 응답에 존재하지 않는다 — 확인됨, 더 이상
 * [ASSUMED]가 아니라 "이 API로는 제공되지 않음"이 확정 사실이다. 분류코드가 필요하면
 * 별도 API(사전규격정보서비스 등) 연동이 필요하며, 그 전까지 classificationCode는 항상
 * null로 남는다 — MATCH-01 매칭은 이 필드가 null이면 스킵되므로(db-schema-design.md
 * §스파인) 실제 배포 시 반드시 후속 작업으로 다뤄야 한다(.planning/phases/02-mvp/
 * deferred-items.md 참고).
 */
interface NarajangteoApiItem {
  bidNtceNo?: string;
  bidNtceOrd?: string | number;
  bidNtceNm?: string;
  dminsttNm?: string;
  presmptPrce?: string | number;
  bidBeginDt?: string;
  bidClseDt?: string;
  /** 나라장터가 직접 내려주는 상세 페이지 링크 — 직접 URL을 조립하지 않고 이 값을 그대로 쓴다. */
  bidNtceDtlUrl?: string;
  [key: string]: unknown;
}

interface NarajangteoApiSuccessResponse {
  response: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { items?: NarajangteoApiItem[]; totalCount?: number };
  };
}

/**
 * 실제 라이브 검증에서 확인된 에러 응답 형태 — 성공 응답(`response.header`)과 완전히 다른
 * 최상위 키(`nkoneps.com.response.ResponseError`)를 쓴다. 이 형태를 확인하지 못하면
 * `payload.response?.header?.resultCode`가 그냥 `undefined`가 되어 "정상 응답인데 0건"과
 * 구분되지 않는다 — 실제로 이 상태로 배포되어 있었다(필수 파라미터 누락 에러를 매 폴링마다
 * 조용히 "0건 수집"으로 삼켜온 것을 이번 라이브 검증에서 발견).
 */
interface NarajangteoApiErrorResponse {
  'nkoneps.com.response.ResponseError'?: {
    header?: { resultCode?: string; resultMsg?: string };
  };
}

type NarajangteoApiResponse =
  | NarajangteoApiSuccessResponse
  | NarajangteoApiErrorResponse;

function isErrorResponse(
  payload: NarajangteoApiResponse,
): payload is NarajangteoApiErrorResponse {
  return 'nkoneps.com.response.ResponseError' in payload;
}

/** YYYYMMDDHHmm(12자리) — 라이브 검증으로 확인된 이 서비스의 날짜 파라미터 형식. */
function formatKstDateTime(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const mi = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}${hh}${mi}`;
}

/**
 * 실제 나라장터 API를 Node 내장 fetch로 호출하는 완전한 프로덕션 구현.
 * ANNOUNCEMENT_SOURCE=g2b로 전환하기 전까지는 절대 호출되지 않는다(팩토리 프로바이더가
 * 선택하지 않음). NARAJANGTEO_API_KEY 환경변수가 없으면 호출을 시도하지 않고 빈 배열을
 * 반환해 배치 잡 전체를 실패시키지 않는다.
 *
 * 응답 필드명은 실제 승인된 서비스키로 라이브 검증됨(2026-08-27) — 레코드 단위 파싱 실패는
 * 개별적으로 로그만 남기고 나머지 레코드 처리를 막지 않는다.
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

    const now = new Date();
    const windowStart = new Date(
      now.getTime() - INQUIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    const url = new URL(NARAJANGTEO_BID_ANNOUNCEMENT_ENDPOINT);
    url.searchParams.set('serviceKey', this.apiKey);
    url.searchParams.set('type', 'json');
    url.searchParams.set('numOfRows', '100');
    url.searchParams.set('pageNo', '1');
    // 필수 파라미터 — 라이브 검증(2026-08-27)으로 확인. 누락 시 정상 HTTP 200 +
    // resultCode "08"("필수값 입력 에러")를 받지만, 이 응답 형태를 isErrorResponse()로
    // 감지하지 않으면 그냥 빈 결과로 보인다.
    url.searchParams.set('inqryDiv', '1'); // 1 = 공고게시일시 기준 조회
    url.searchParams.set('inqryBgnDt', formatKstDateTime(windowStart));
    url.searchParams.set('inqryEndDt', formatKstDateTime(now));

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

    if (isErrorResponse(payload)) {
      const header = payload['nkoneps.com.response.ResponseError']?.header;
      this.logger.error(
        `나라장터 API 오류 응답: ${header?.resultCode ?? '(코드 없음)'} ${header?.resultMsg ?? ''}`,
      );
      return [];
    }

    const resultCode = payload.response.header?.resultCode;
    if (resultCode !== undefined && resultCode !== '00') {
      this.logger.error(
        `나라장터 API 오류 응답: ${resultCode} ${payload.response.header?.resultMsg ?? ''}`,
      );
      return [];
    }

    const items = payload.response.body?.items ?? [];
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
      // 이 API는 물품분류번호를 제공하지 않는다(라이브 검증으로 확인, 더 이상 가정이
      // 아님) — MATCH-01 매칭은 classificationCode가 null이면 스킵된다는 점을 인지하고
      // 있어야 한다. 별도 API 연동 전까지는 항상 null.
      classificationCode: null,
      // 참가가능지역 필드 위치 미확인 — 확정 전까지 빈 배열(전국 취급).
      regionCodes: [],
      agencyName: item.dminsttNm ?? null,
      budgetAmount: item.presmptPrce ?? null,
      bidOpenAt: item.bidBeginDt ?? null,
      bidCloseAt: item.bidClseDt ?? null,
      raw: item,
    };
  }
}
