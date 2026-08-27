import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { BidAnnouncement, Match, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MeilisearchService } from '../search/meilisearch.service';
import {
  QualitativeTier,
  toQualitativeTier,
} from '../matching/matching.service';
import {
  ANNOUNCEMENT_SOURCE_PORT,
  type AnnouncementSourcePort,
  type RawAnnouncement,
} from './ports/announcement-source.port';
import type { SearchQueryDto } from './dto/search-query.dto';

interface NormalizedAnnouncement {
  sourceBidNo: string;
  sourceRevisionNo: string;
  title: string;
  classificationCode: string | null;
  regionCodes: string[];
  agencyName: string | null;
  budgetAmount: Prisma.Decimal | null;
  bidOpenAt: Date | null;
  bidCloseAt: Date | null;
  rawPayload: Prisma.InputJsonValue;
}

const CLASSIFICATION_CODE_PATTERN = /^[0-9]+$/;
const VALID_CLASSIFICATION_CODE_LENGTHS = new Set([2, 4, 6, 8]);

/**
 * source_revision_no 정규화 — 빈 문자열/누락/숫자 세 가지 입력 형태를 모두 안전한
 * 문자열로 정규화한다. 실제 나라장터 응답에서 이 필드가 어떻게 채워지는지 검증되지
 * 않았으므로(db-schema-design.md §Phase 2 인계 사항 3), 빈 문자열·누락은 '0' 기본값으로,
 * 숫자 타입은 문자열로 변환한다(값 자체를 임의로 '0'으로 덮어쓰지 않는다).
 */
function normalizeRevisionNo(raw: RawAnnouncement['sourceRevisionNo']): string {
  if (raw === undefined || raw === null) return '0';
  if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : '0';
  const trimmed = raw.trim();
  return trimmed === '' ? '0' : trimmed;
}

/** 개정 차수 비교 — 숫자로 파싱 가능하면 숫자 비교, 아니면 문자열 비교로 폴백한다. */
function compareRevisionNo(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) {
    return na - nb;
  }
  return a.localeCompare(b);
}

function normalizeClassificationCode(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (
    !CLASSIFICATION_CODE_PATTERN.test(trimmed) ||
    !VALID_CLASSIFICATION_CODE_LENGTHS.has(trimmed.length)
  ) {
    // db-schema-design.md CHECK 제약(length IN (2,4,6,8), 숫자만)을 만족하지 못하는 원문은
    // 저장을 막는 대신 NULL로 정규화한다(§스파인이 강제하는 설계 제약 (c) — 결측이 관련
    // 없음을 의미하지 않으므로 공고 자체를 버리지 않는다).
    return null;
  }
  return trimmed;
}

function normalizeBudgetAmount(
  raw: string | number | null | undefined,
): Prisma.Decimal | null {
  if (raw === null || raw === undefined || raw === '') return null;
  try {
    return new Prisma.Decimal(raw);
  } catch {
    return null;
  }
}

function normalizeDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 대분류(2자리) 물품분류코드 → 한글 업종명. apps/web/src/lib/classification-tree.data.ts
 * (docs/design/업종-물품분류-매핑.md §목표 업종 매핑표)와 동일한 원본을 따르되, API가
 * 프론트엔드 워크스페이스 파일을 직접 import할 수 없어 이 파일에 최소 복제본을 둔다.
 * "시설관리"는 물품분류번호가 아직 미확정(confirmed: false)이라 여기 포함하지 않는다.
 */
const CLASSIFICATION_LABELS: Record<string, string> = {
  '43': '정보통신·소프트웨어개발',
  '44': '사무용품',
  '55': '인쇄·출판',
};

/**
 * 업체가 등록한 prefix 목록 중 공고 classification_code와 가장 길게(자릿수 기준) 일치하는
 * prefix를 찾는다. matching.service.ts의 scoreMatch() bestMatchLength 계산과 동일한 규칙을
 * 쓰되, 점수가 아니라 실제 매칭 근거 문구(02-feed.md "정보통신(43) 업종 등록과 일치")를
 * 만들기 위해 어떤 prefix가 일치했는지를 반환한다.
 */
function findBestMatchingPrefix(
  companyCodes: string[],
  announcementCode: string | null,
): string | null {
  if (!announcementCode) return null;
  let best: string | null = null;
  for (const code of companyCodes) {
    if (
      announcementCode.startsWith(code) &&
      (!best || code.length > best.length)
    ) {
      best = code;
    }
  }
  return best;
}

/** 02-feed.md §레이아웃 3 "매칭 근거 한 줄" 문구 생성. */
function buildMatchReason(
  companyCodes: string[],
  announcementCode: string | null,
): string {
  const prefix = findBestMatchingPrefix(companyCodes, announcementCode);
  if (!prefix) {
    return '등록하신 프로필과 매칭되었습니다.';
  }
  const label = CLASSIFICATION_LABELS[prefix] ?? `업종코드 ${prefix}`;
  return `${label}(${prefix}) 업종 등록과 일치`;
}

/**
 * 나라장터 원문 링크(03-detail.md §레이아웃 2, T-01-15 필수 요소).
 * 실제 나라장터 API(g2b-announcement-source.adapter.ts)는 응답 아이템에 상세 페이지
 * 링크(`bidNtceDtlUrl`)를 직접 내려준다 — 라이브 검증(2026-08-27)으로 확인. raw_payload에
 * 이 필드가 있으면 그대로 쓰고, 없으면(fixture 데이터 등, 이 필드가 없는 경우) 예전에
 * [ASSUMED]로 조립하던 폴백 패턴을 그대로 유지한다 — 실제로는 이 폴백이 옳은 나라장터
 * URL이 아님이 이미 확인됐지만(라이브 검증 중 발견), fixture 픽스처의 공고번호 자체가
 * 가짜라 애초에 실재하는 링크를 만들 수 없으므로 "원문 링크 버튼이 존재하고 클릭 가능하다"는
 * UI 계약만 충족시키는 자리표시자로 남긴다.
 */
function buildSourceUrl(
  sourceBidNo: string,
  sourceRevisionNo: string,
  rawPayload?: unknown,
): string {
  if (rawPayload && typeof rawPayload === 'object') {
    const detailUrl = (rawPayload as Record<string, unknown>).bidNtceDtlUrl;
    if (typeof detailUrl === 'string' && detailUrl.length > 0) {
      return detailUrl;
    }
  }
  const url = new URL(
    'https://www.g2b.go.kr:8101/ep/invitation/publish/bidInfoDtl.do',
  );
  url.searchParams.set('bidno', sourceBidNo);
  url.searchParams.set('bidseq', sourceRevisionNo);
  return url.toString();
}

export type FeedSort = 'score' | 'deadline' | 'latest';

export interface FeedItemDto {
  id: string;
  title: string;
  agencyName: string | null;
  classificationCode: string | null;
  regionCodes: string[];
  budgetAmount: string | null;
  bidCloseAt: string | null;
  isExpired: boolean;
  /** 5단계 정성 등급만 노출한다 — 원점수는 이 DTO에 필드 자체가 존재하지 않는다(T-02-13). */
  qualitativeTier: QualitativeTier;
  matchReason: string;
}

export interface FeedResponseDto {
  items: FeedItemDto[];
  hasMore: boolean;
  page: number;
}

export interface AnnouncementDetailResponseDto {
  found: boolean;
  id?: string;
  title?: string;
  sourceBidNo?: string;
  sourceRevisionNo?: string;
  isLatestRevision?: boolean;
  agencyName?: string | null;
  classificationCode?: string | null;
  regionCodes?: string[];
  budgetAmount?: string | null;
  bidOpenAt?: string | null;
  bidCloseAt?: string | null;
  isExpired?: boolean;
  hasParsingGaps?: boolean;
  matchFound?: boolean;
  matchReason?: string;
  matchedPrefix?: string | null;
  regionMatched?: boolean;
  sourceUrl?: string;
  /** 개정되어 최신 차수가 따로 있는 경우에만 값이 있다(03-detail.md §엣지 케이스). */
  latestRevisionId?: string | null;
}

const FEED_PAGE_SIZE = 20;

/**
 * ING-01~03 구현 — 활성 AnnouncementSourcePort(픽스처 또는 실제 나라장터 API)에서 받은
 * 원문을 정규화해 bid_announcements에 UPSERT한다. 02-RESEARCH.md Pattern 1(수집→매칭→발송)의
 * 첫 단계. 02-06부터는 GET /feed·GET /announcements/:id 조회(ING-04, CLIENT-01)도 이
 * 서비스가 담당한다.
 */
@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ANNOUNCEMENT_SOURCE_PORT)
    private readonly source: AnnouncementSourcePort,
    private readonly searchService: MeilisearchService,
  ) {}

  /**
   * 활성 소스에서 최신 원문을 받아 정규화·UPSERT한다. 개정 병합 규칙
   * (db-schema-design.md §복수성·병합 규칙 (b)): 같은 source_bid_no에 더 큰
   * source_revision_no가 들어오면 이전 차수 행의 is_latest_revision을 false로 갱신하고
   * 새 행을 is_latest_revision=true로 삽입한다 — 기존 matches 행은 삭제하지 않는다.
   */
  async pollAndUpsert(): Promise<{ upsertedIds: string[] }> {
    const raws = await this.source.fetchLatest();
    const upsertedIds: string[] = [];

    for (const raw of raws) {
      try {
        const id = await this.upsertOne(raw);
        upsertedIds.push(id);
      } catch (err) {
        // 한 레코드의 정규화·저장 실패가 배치 전체를 막지 않는다 — G2BAnnouncementSourceAdapter의
        // 개별 레코드 격리 원칙과 동일하게, 서비스 레벨에서도 방어한다.
        const message = err instanceof Error ? err.message : 'unknown error';
        this.logger.error(
          `공고 upsert 실패(source_bid_no=${raw.sourceBidNo}, 개별 스킵): ${message}`,
        );
      }
    }

    return { upsertedIds };
  }

  private normalize(raw: RawAnnouncement): NormalizedAnnouncement {
    return {
      sourceBidNo: raw.sourceBidNo,
      sourceRevisionNo: normalizeRevisionNo(raw.sourceRevisionNo),
      title: raw.title,
      classificationCode: normalizeClassificationCode(raw.classificationCode),
      regionCodes: raw.regionCodes ?? [],
      agencyName: raw.agencyName ?? null,
      budgetAmount: normalizeBudgetAmount(raw.budgetAmount),
      bidOpenAt: normalizeDate(raw.bidOpenAt),
      bidCloseAt: normalizeDate(raw.bidCloseAt),
      rawPayload: raw.raw as Prisma.InputJsonValue,
    };
  }

  private async upsertOne(raw: RawAnnouncement): Promise<string> {
    const normalized = this.normalize(raw);

    // 같은 (source_bid_no, source_revision_no) 조합이 이미 있으면 재폴링에 의한 갱신 —
    // is_latest_revision 플래그는 건드리지 않고 내용만 최신화한다.
    const existingSameRevision = await this.prisma.bidAnnouncement.findUnique({
      where: {
        sourceBidNo_sourceRevisionNo: {
          sourceBidNo: normalized.sourceBidNo,
          sourceRevisionNo: normalized.sourceRevisionNo,
        },
      },
    });

    if (existingSameRevision) {
      const updated = await this.prisma.bidAnnouncement.update({
        where: { id: existingSameRevision.id },
        data: {
          title: normalized.title,
          classificationCode: normalized.classificationCode,
          regionCodes: normalized.regionCodes,
          agencyName: normalized.agencyName,
          budgetAmount: normalized.budgetAmount,
          bidOpenAt: normalized.bidOpenAt,
          bidCloseAt: normalized.bidCloseAt,
          rawPayload: normalized.rawPayload,
        },
      });
      await this.indexForSearch(updated);
      return updated.id;
    }

    // 새 차수 — 이 source_bid_no의 현재 최신 행을 찾아 비교한다.
    const priorLatest = await this.prisma.bidAnnouncement.findFirst({
      where: {
        sourceBidNo: normalized.sourceBidNo,
        isLatestRevision: true,
      },
    });

    const isNewer =
      !priorLatest ||
      compareRevisionNo(
        normalized.sourceRevisionNo,
        priorLatest.sourceRevisionNo,
      ) > 0;

    if (priorLatest && isNewer) {
      await this.prisma.bidAnnouncement.update({
        where: { id: priorLatest.id },
        data: { isLatestRevision: false },
      });
    }

    const created = await this.prisma.bidAnnouncement.create({
      data: {
        sourceBidNo: normalized.sourceBidNo,
        sourceRevisionNo: normalized.sourceRevisionNo,
        isLatestRevision: !priorLatest || isNewer,
        title: normalized.title,
        classificationCode: normalized.classificationCode,
        regionCodes: normalized.regionCodes,
        agencyName: normalized.agencyName,
        budgetAmount: normalized.budgetAmount,
        bidOpenAt: normalized.bidOpenAt,
        bidCloseAt: normalized.bidCloseAt,
        rawPayload: normalized.rawPayload,
      },
    });
    await this.indexForSearch(created);
    return created.id;
  }

  /**
   * upsert 직후 Meilisearch 색인을 동기 호출한다(02-06-PLAN.md key_links — "upsert 직후
   * indexAnnouncement(record) 호출"). MeilisearchService 자체가 실패를 흡수하므로 이 호출이
   * pollAndUpsert()의 상위 try/catch로 예외를 전파하지는 않지만, 방어적으로 한 번 더 감싼다.
   */
  private async indexForSearch(row: BidAnnouncement): Promise<void> {
    try {
      await this.searchService.indexAnnouncement({
        id: row.id,
        title: row.title,
        agencyName: row.agencyName,
        classificationCode: row.classificationCode,
        regionCodes: row.regionCodes,
        bidCloseAt: row.bidCloseAt
          ? Math.floor(row.bidCloseAt.getTime() / 1000)
          : null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`Meilisearch 색인 호출 실패(id=${row.id}): ${message}`);
    }
  }

  /**
   * GET /feed — ING-04(키워드·업종·지역·마감일 검색·필터링) + CLIENT-01 피드 화면.
   *
   * `matches.company_id = 로그인 업체`로 항상 스코프한다(db-schema-design.md §스파인 조인
   * SQL, T-01-12) — idx_matches_company_id_matched_at 인덱스가 이 조회 패턴을 위해 이미
   * 존재한다. keyword가 있으면 Meilisearch 후보 id 집합을 먼저 얻고, classification/region/
   * deadline/includeExpired는 애플리케이션 레벨에서 in-memory로 교집합을 취한다 — 업체당
   * 매칭 건수가 MVP 규모에서 크지 않고(prefix 매칭 후보로 이미 좁혀진 상태), 이 방식이
   * region_codes 배열 컬럼에 대한 복잡한 SQL 연산자 조합보다 테스트·유지보수가 쉽다
   * (db-schema-design.md §Phase 2 인계 사항 7 — GIN 인덱스 보류 판단과 같은 취지).
   *
   * 응답 DTO(FeedItemDto)에는 score 필드가 아예 없다 — qualitativeTier만 직렬화한다
   * (T-02-13, Legal 제약).
   */
  async getFeed(
    companyId: string,
    query: SearchQueryDto,
  ): Promise<FeedResponseDto> {
    const now = new Date();
    const page = query.page ?? 1;
    const sort: FeedSort = query.sort ?? 'score';

    let keywordIds: Set<string> | null = null;
    if (query.keyword && query.keyword.trim() !== '') {
      const ids = await this.searchService.searchAnnouncementIds(
        query.keyword.trim(),
      );
      keywordIds = new Set(ids);
      if (keywordIds.size === 0) {
        return { items: [], hasMore: false, page };
      }
    }

    const matches = await this.prisma.match.findMany({
      where: { companyId },
      include: { announcement: true },
      orderBy: { matchedAt: 'desc' },
    });

    const deadlineWindow = buildDeadlineWindow(now, query.deadline);
    const includeExpired = query.includeExpired ?? false;

    const filtered = matches.filter(({ announcement }) => {
      if (keywordIds && !keywordIds.has(announcement.id)) return false;

      if (query.classification && query.classification.length > 0) {
        const hit = query.classification.some(
          (prefix) =>
            announcement.classificationCode?.startsWith(prefix) ?? false,
        );
        if (!hit) return false;
      }

      if (query.region && query.region.length > 0) {
        const hit = query.region.some((r) =>
          announcement.regionCodes.includes(r),
        );
        if (!hit) return false;
      }

      const isExpired = isAnnouncementExpired(announcement, now);
      if (isExpired && !includeExpired) return false;

      if (deadlineWindow && announcement.bidCloseAt) {
        if (
          announcement.bidCloseAt < deadlineWindow.from ||
          announcement.bidCloseAt > deadlineWindow.to
        ) {
          return false;
        }
      } else if (deadlineWindow && !announcement.bidCloseAt) {
        // 마감일 정보 자체가 없는 공고는 "이번 주/이번 달" 범위 필터와 결합할 수 없어 제외한다.
        return false;
      }

      return true;
    });

    const sorted = sortFeedMatches(filtered, sort);
    const start = (page - 1) * FEED_PAGE_SIZE;
    const pageSlice = sorted.slice(start, start + FEED_PAGE_SIZE + 1);
    const hasMore = pageSlice.length > FEED_PAGE_SIZE;
    const pageItems = pageSlice.slice(0, FEED_PAGE_SIZE);

    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      include: { classificationCodes: true },
    });
    const companyCodes = company.classificationCodes.map(
      (c) => c.classificationCode,
    );

    const items: FeedItemDto[] = pageItems.map((match) =>
      buildFeedItem(match, companyCodes, now),
    );

    return { items, hasMore, page };
  }

  /**
   * GET /announcements/:id — CLIENT-01 상세 화면. `raw_payload` 전체는 절대 반환하지 않고
   * 정규화된 필드만 반환한다(03-detail.md §데이터 소스).
   *
   * `match_id`가 쿼리에 있으면(이메일 알림 경로) 그 매칭의 소유권을 검증해 다른 업체
   * 소유면 403을 던진다(T-01-16, 03-detail.md §엣지 케이스 "다른 업체의 매칭 식별자로
   * 접근 시도"). 공고 자체가 DB에 없으면(취소·삭제) 404 대신 `found: false`를 담은 200을
   * 반환한다 — 프론트가 별도 에러 경계 없이 안내 문구를 인라인 렌더링할 수 있게 하기 위함
   * (03-detail.md §엣지 케이스 "취소·삭제된 공고").
   */
  async getDetail(
    companyId: string,
    announcementId: string,
    matchIdParam?: string,
  ): Promise<AnnouncementDetailResponseDto> {
    if (matchIdParam) {
      const matchByParam = await this.prisma.match.findUnique({
        where: { id: matchIdParam },
      });
      if (!matchByParam || matchByParam.companyId !== companyId) {
        throw new ForbiddenException(
          '본인 업체의 매칭 정보로만 상세를 조회할 수 있습니다.',
        );
      }
    }

    const announcement = await this.prisma.bidAnnouncement.findUnique({
      where: { id: announcementId },
    });
    if (!announcement) {
      return { found: false };
    }

    const [match, company] = await Promise.all([
      this.prisma.match.findUnique({
        where: { companyId_announcementId: { companyId, announcementId } },
      }),
      this.prisma.company.findUniqueOrThrow({
        where: { id: companyId },
        include: { classificationCodes: true },
      }),
    ]);

    const companyCodes = company.classificationCodes.map(
      (c) => c.classificationCode,
    );
    const matchedPrefix = findBestMatchingPrefix(
      companyCodes,
      announcement.classificationCode,
    );
    const regionMatched =
      announcement.regionCodes.length === 0 ||
      company.regionCodes.some((r) => announcement.regionCodes.includes(r));

    let latestRevisionId: string | null = null;
    if (!announcement.isLatestRevision) {
      const latest = await this.prisma.bidAnnouncement.findFirst({
        where: {
          sourceBidNo: announcement.sourceBidNo,
          isLatestRevision: true,
        },
      });
      latestRevisionId = latest?.id ?? null;
    }

    return {
      found: true,
      id: announcement.id,
      title: announcement.title,
      sourceBidNo: announcement.sourceBidNo,
      sourceRevisionNo: announcement.sourceRevisionNo,
      isLatestRevision: announcement.isLatestRevision,
      agencyName: announcement.agencyName,
      classificationCode: announcement.classificationCode,
      regionCodes: announcement.regionCodes,
      budgetAmount: announcement.budgetAmount?.toString() ?? null,
      bidOpenAt: announcement.bidOpenAt?.toISOString() ?? null,
      bidCloseAt: announcement.bidCloseAt?.toISOString() ?? null,
      isExpired: isAnnouncementExpired(announcement, new Date()),
      hasParsingGaps:
        announcement.classificationCode === null ||
        announcement.agencyName === null ||
        announcement.budgetAmount === null,
      matchFound: !!match,
      matchReason: buildMatchReason(
        companyCodes,
        announcement.classificationCode,
      ),
      matchedPrefix,
      regionMatched,
      sourceUrl: buildSourceUrl(
        announcement.sourceBidNo,
        announcement.sourceRevisionNo,
        announcement.rawPayload,
      ),
      latestRevisionId,
    };
  }
}

function isAnnouncementExpired(
  announcement: Pick<BidAnnouncement, 'bidCloseAt'>,
  now: Date,
): boolean {
  return announcement.bidCloseAt !== null && announcement.bidCloseAt < now;
}

interface DeadlineWindow {
  from: Date;
  to: Date;
}

/**
 * "이번 주"는 오늘부터 +7일, "이번 달"은 오늘부터 +30일 윈도로 근사한다(캘린더 월 경계
 * 대신 일수 기반 — 02-feed.md가 정확한 캘린더 규칙을 명시하지 않아 단순한 규칙을 택함).
 */
function buildDeadlineWindow(
  now: Date,
  deadline: 'this_week' | 'this_month' | undefined,
): DeadlineWindow | null {
  if (!deadline) return null;
  const to = new Date(now);
  to.setDate(to.getDate() + (deadline === 'this_week' ? 7 : 30));
  return { from: now, to };
}

function sortFeedMatches(
  matches: (Match & { announcement: BidAnnouncement })[],
  sort: FeedSort,
): (Match & { announcement: BidAnnouncement })[] {
  const copy = [...matches];
  switch (sort) {
    case 'deadline':
      return copy.sort((a, b) => {
        const aTime = a.announcement.bidCloseAt?.getTime() ?? Infinity;
        const bTime = b.announcement.bidCloseAt?.getTime() ?? Infinity;
        return aTime - bTime;
      });
    case 'latest':
      return copy.sort(
        (a, b) =>
          b.announcement.fetchedAt.getTime() -
          a.announcement.fetchedAt.getTime(),
      );
    case 'score':
    default:
      return copy.sort((a, b) => Number(b.score) - Number(a.score));
  }
}

function buildFeedItem(
  match: Match & { announcement: BidAnnouncement },
  companyCodes: string[],
  now: Date,
): FeedItemDto {
  const { announcement } = match;
  return {
    id: announcement.id,
    title: announcement.title,
    agencyName: announcement.agencyName,
    classificationCode: announcement.classificationCode,
    regionCodes: announcement.regionCodes,
    budgetAmount: announcement.budgetAmount?.toString() ?? null,
    bidCloseAt: announcement.bidCloseAt?.toISOString() ?? null,
    isExpired: isAnnouncementExpired(announcement, now),
    qualitativeTier: toQualitativeTier(Number(match.score)),
    matchReason: buildMatchReason(
      companyCodes,
      announcement.classificationCode,
    ),
  };
}
