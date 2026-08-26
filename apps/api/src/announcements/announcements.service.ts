import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ANNOUNCEMENT_SOURCE_PORT,
  type AnnouncementSourcePort,
  type RawAnnouncement,
} from './ports/announcement-source.port';

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
 * ING-01~03 구현 — 활성 AnnouncementSourcePort(픽스처 또는 실제 나라장터 API)에서 받은
 * 원문을 정규화해 bid_announcements에 UPSERT한다. 02-RESEARCH.md Pattern 1(수집→매칭→발송)의
 * 첫 단계.
 */
@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ANNOUNCEMENT_SOURCE_PORT)
    private readonly source: AnnouncementSourcePort,
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
    return created.id;
  }
}
