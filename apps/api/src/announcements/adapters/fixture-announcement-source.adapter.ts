import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import type {
  AnnouncementSourcePort,
  RawAnnouncement,
} from '../ports/announcement-source.port';

/**
 * `apps/api/tests/fixtures/*.json` 픽스처의 이미 정규화된 형태 — 02-01의 seed.ts,
 * 02-05의 벌크/개정 픽스처가 공유하는 공통 스키마.
 */
interface FixtureRecord {
  sourceBidNo: string;
  sourceRevisionNo: string;
  title: string;
  classificationCode: string | null;
  regionCodes: string[];
  agencyName?: string | null;
  budgetAmount?: string | number | null;
  bidOpenAt?: string | null;
  bidCloseAt?: string | null;
  rawPayload?: Record<string, unknown>;
}

/**
 * ANNOUNCEMENT_SOURCE 환경변수의 기본값이자, 나라장터 API 미승인 상태의 현재 활성 구현.
 * `apps/api/tests/fixtures/`의 JSON 픽스처 파일을 읽어 AnnouncementSourcePort 계약대로
 * 반환한다 — G2BAnnouncementSourceAdapter와 동일한 인터페이스이므로 AnnouncementsService는
 * 어느 쪽이 활성인지 알 필요가 없다.
 */
export class FixtureAnnouncementSourceAdapter implements AnnouncementSourcePort {
  private readonly logger = new Logger(FixtureAnnouncementSourceAdapter.name);

  /**
   * @param fixtureFileName tests/fixtures/ 아래 파일명. 기본값은 02-01이 만든
   *   5건 픽스처(announcements.sample.json) — 배치 수집 파이프라인의 기본 시드 데이터로
   *   재사용해 별도 중복 픽스처를 만들지 않는다. 단위테스트는 다른 파일명(예:
   *   announcements.revision.sample.json)을 명시적으로 넘겨 개정 병합 시나리오를 구성한다.
   */
  constructor(
    private readonly fixtureFileName: string = 'announcements.sample.json',
  ) {}

  fetchLatest(): Promise<RawAnnouncement[]> {
    const path = join(
      __dirname,
      '..',
      '..',
      '..',
      'tests',
      'fixtures',
      this.fixtureFileName,
    );

    let records: FixtureRecord[];
    try {
      records = JSON.parse(readFileSync(path, 'utf-8')) as FixtureRecord[];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`픽스처 파일 로드 실패(${path}): ${message}`);
      return Promise.resolve([]);
    }

    return Promise.resolve(
      records.map((r) => ({
        sourceBidNo: r.sourceBidNo,
        sourceRevisionNo: r.sourceRevisionNo,
        title: r.title,
        classificationCode: r.classificationCode,
        regionCodes: r.regionCodes,
        agencyName: r.agencyName ?? null,
        budgetAmount: r.budgetAmount ?? null,
        bidOpenAt: r.bidOpenAt ?? null,
        bidCloseAt: r.bidCloseAt ?? null,
        raw: r.rawPayload ?? (r as unknown as Record<string, unknown>),
      })),
    );
  }
}
