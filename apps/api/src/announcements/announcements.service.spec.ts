import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PrismaService } from '../prisma/prisma.service';
import { AnnouncementsService } from './announcements.service';
import { selectAnnouncementSource } from './announcements.module';
import { FixtureAnnouncementSourceAdapter } from './adapters/fixture-announcement-source.adapter';
import { G2BAnnouncementSourceAdapter } from './adapters/g2b-announcement-source.adapter';
import type {
  AnnouncementSourcePort,
  RawAnnouncement,
} from './ports/announcement-source.port';

interface RevisionFixtureRecord {
  sourceBidNo: string;
  sourceRevisionNo: string;
  title: string;
  classificationCode: string | null;
  regionCodes: string[];
  agencyName: string | null;
  budgetAmount: string | null;
  bidOpenAt: string | null;
  bidCloseAt: string | null;
  rawPayload: Record<string, unknown>;
}

// tsconfig에 resolveJsonModule이 없어(범위 밖 변경 회피) seed.ts/FixtureAdapter와 동일하게
// readFileSync + JSON.parse로 픽스처를 로드한다.
const revisionFixture: RevisionFixtureRecord[] = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '..',
      '..',
      'tests',
      'fixtures',
      'announcements.revision.sample.json',
    ),
    'utf-8',
  ),
) as RevisionFixtureRecord[];

interface FakeRow {
  id: string;
  sourceBidNo: string;
  sourceRevisionNo: string;
  isLatestRevision: boolean;
  [key: string]: unknown;
}

/**
 * PrismaService의 bidAnnouncement 모델 서브셋만 구현하는 인메모리 페이크.
 * 이 실행 환경에 Docker/PostgreSQL이 없어(WINDOWS.md 기존 갭과 동일) 실DB 통합테스트
 * 대신 순수 단위테스트로 AnnouncementsService의 정규화·개정 병합 로직을 검증한다.
 */
function makeFakePrisma() {
  const rows: FakeRow[] = [];
  let idCounter = 0;

  const model = {
    findUnique: ({
      where,
    }: {
      where: {
        sourceBidNo_sourceRevisionNo: {
          sourceBidNo: string;
          sourceRevisionNo: string;
        };
      };
    }) => {
      const { sourceBidNo, sourceRevisionNo } =
        where.sourceBidNo_sourceRevisionNo;
      return Promise.resolve(
        rows.find(
          (r) =>
            r.sourceBidNo === sourceBidNo &&
            r.sourceRevisionNo === sourceRevisionNo,
        ) ?? null,
      );
    },
    findFirst: ({
      where,
    }: {
      where: { sourceBidNo: string; isLatestRevision: boolean };
    }) => {
      return Promise.resolve(
        rows.find(
          (r) =>
            r.sourceBidNo === where.sourceBidNo &&
            r.isLatestRevision === where.isLatestRevision,
        ) ?? null,
      );
    },
    create: ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `row-${++idCounter}`, ...data } as FakeRow;
      rows.push(row);
      return Promise.resolve(row);
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const row = rows.find((r) => r.id === where.id);
      if (!row) throw new Error(`row not found: ${where.id}`);
      Object.assign(row, data);
      return Promise.resolve(row);
    },
  };

  return {
    prisma: { bidAnnouncement: model } as unknown as PrismaService,
    rows,
  };
}

function makeSourcePort(raws: RawAnnouncement[]): AnnouncementSourcePort {
  return { fetchLatest: () => Promise.resolve(raws) };
}

/**
 * MeilisearchService의 최소 페이크 — 02-06이 pollAndUpsert()의 upsertOne() 직후 색인 호출을
 * 추가하면서 AnnouncementsService 생성자에 3번째 인자로 추가됐다. 이 스펙은 색인 자체가
 * 아니라 정규화·개정 병합 로직을 검증하므로 실제 Meilisearch 호출 없이 no-op으로 흡수한다.
 */
function makeFakeSearchService() {
  return {
    indexAnnouncement: jest.fn().mockResolvedValue(undefined),
    searchAnnouncementIds: jest.fn().mockResolvedValue([]),
  } as unknown as import('../search/meilisearch.service').MeilisearchService;
}

describe('AnnouncementsService', () => {
  it('ANNOUNCEMENT_SOURCE=fixture(기본값)로 pollAndUpsert() 실행 시 픽스처의 공고가 모두 bid_announcements에 적재된다', async () => {
    const { prisma, rows } = makeFakePrisma();
    const adapter = new FixtureAnnouncementSourceAdapter(); // 기본값: announcements.sample.json (5건)
    const service = new AnnouncementsService(
      prisma,
      adapter,
      makeFakeSearchService(),
    );

    const { upsertedIds } = await service.pollAndUpsert();

    expect(upsertedIds).toHaveLength(5);
    expect(rows).toHaveLength(5);
  });

  it('classification_code가 없는(null) 원문도 예외 없이 적재된다', async () => {
    const { prisma, rows } = makeFakePrisma();
    const adapter = new FixtureAnnouncementSourceAdapter();
    const service = new AnnouncementsService(
      prisma,
      adapter,
      makeFakeSearchService(),
    );

    await expect(service.pollAndUpsert()).resolves.toBeDefined();

    const nullRow = rows.find((r) => r.classificationCode === null);
    expect(nullRow).toBeDefined();
  });

  it('개정 픽스처를 두 번(차수 0, 차수 1) 연속 수집하면 차수 0 행의 is_latest_revision=false, 차수 1 행이 신규 삽입되고 is_latest_revision=true, 총 2개 행이 존재한다(삭제되지 않음)', async () => {
    const { prisma, rows } = makeFakePrisma();

    const toRaw = (r: (typeof revisionFixture)[number]): RawAnnouncement => ({
      sourceBidNo: r.sourceBidNo,
      sourceRevisionNo: r.sourceRevisionNo,
      title: r.title,
      classificationCode: r.classificationCode,
      regionCodes: r.regionCodes,
      agencyName: r.agencyName,
      budgetAmount: r.budgetAmount,
      bidOpenAt: r.bidOpenAt,
      bidCloseAt: r.bidCloseAt,
      raw: r.rawPayload,
    });

    const rev0 = revisionFixture.find((r) => r.sourceRevisionNo === '0')!;
    const rev1 = revisionFixture.find((r) => r.sourceRevisionNo === '1')!;

    // 1차 수집 — 차수 0만 도착
    const firstPoll = new AnnouncementsService(
      prisma,
      makeSourcePort([toRaw(rev0)]),
      makeFakeSearchService(),
    );
    await firstPoll.pollAndUpsert();

    expect(rows).toHaveLength(1);
    expect(rows[0].isLatestRevision).toBe(true);
    expect(rows[0].sourceRevisionNo).toBe('0');

    // 2차 수집 — 별도 배치 폴링에서 차수 1(정정공고) 도착
    const secondPoll = new AnnouncementsService(
      prisma,
      makeSourcePort([toRaw(rev1)]),
      makeFakeSearchService(),
    );
    await secondPoll.pollAndUpsert();

    expect(rows).toHaveLength(2); // 삭제되지 않고 2개 행 존재
    const row0 = rows.find((r) => r.sourceRevisionNo === '0')!;
    const row1 = rows.find((r) => r.sourceRevisionNo === '1')!;
    expect(row0.isLatestRevision).toBe(false);
    expect(row1.isLatestRevision).toBe(true);
  });

  describe('ANNOUNCEMENT_SOURCE 팩토리 선택 (선택되지 않는 한 G2B는 호출되지 않는다)', () => {
    it('ANNOUNCEMENT_SOURCE 미설정 시 FixtureAnnouncementSourceAdapter가 선택된다', () => {
      const configService = { get: () => undefined } as unknown as Parameters<
        typeof selectAnnouncementSource
      >[0];
      const source = selectAnnouncementSource(configService);
      expect(source).toBeInstanceOf(FixtureAnnouncementSourceAdapter);
    });

    it('ANNOUNCEMENT_SOURCE=g2b일 때만 G2BAnnouncementSourceAdapter가 선택된다', () => {
      const configService = {
        get: (key: string) =>
          key === 'ANNOUNCEMENT_SOURCE' ? 'g2b' : 'test-narajangteo-key',
      } as unknown as Parameters<typeof selectAnnouncementSource>[0];
      const source = selectAnnouncementSource(configService);
      expect(source).toBeInstanceOf(G2BAnnouncementSourceAdapter);
    });
  });

  describe('G2BAnnouncementSourceAdapter (코드는 존재·컴파일되나 g2b 전환 전에는 호출되지 않음 — 여기서는 어댑터 자체 로직만 fetch 모킹으로 검증)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('정상 레코드는 파싱하고, 필수 필드(bidNtceNo)가 없는 레코드는 개별 스킵한다(전체 실패로 이어지지 않음)', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            response: {
              header: { resultCode: '00' },
              body: {
                items: [
                  {
                    bidNtceNo: '20260900999',
                    bidNtceOrd: '0',
                    bidNtceNm: '테스트 공고',
                    dminsttNm: '테스트 기관',
                    prdctClsfcNo: '43211501',
                    presmptPrce: '1000000',
                    bidBeginDt: '2026-09-01T09:00:00+09:00',
                    bidClseDt: '2026-09-10T18:00:00+09:00',
                  },
                  { bidNtceNm: '공고번호 누락 — 개별 스킵되어야 함' },
                ],
              },
            },
          }),
      });
      global.fetch = mockFetch;

      const adapter = new G2BAnnouncementSourceAdapter('test-api-key');
      const results = await adapter.fetchLatest();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
      expect(results[0].sourceBidNo).toBe('20260900999');
    });

    it('API 키가 없으면 fetch를 시도하지 않고 빈 배열을 반환한다', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      const adapter = new G2BAnnouncementSourceAdapter('');
      const results = await adapter.fetchLatest();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(results).toEqual([]);
    });

    it('요청에 필수 파라미터(inqryDiv/inqryBgnDt/inqryEndDt)를 포함한다 — 라이브 검증(2026-08-27)으로 확인된 필수값, 누락 시 나라장터가 조용히 빈 결과로 보이는 에러를 반환한다', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ response: { header: { resultCode: '00' } } }),
      });
      global.fetch = mockFetch;

      const adapter = new G2BAnnouncementSourceAdapter('test-api-key');
      await adapter.fetchLatest();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = new URL(String(mockFetch.mock.calls[0][0]));
      expect(calledUrl.searchParams.get('inqryDiv')).toBe('1');
      expect(calledUrl.searchParams.get('inqryBgnDt')).toMatch(/^\d{12}$/);
      expect(calledUrl.searchParams.get('inqryEndDt')).toMatch(/^\d{12}$/);
    });

    it('나라장터의 실제 에러 응답 형태(nkoneps.com.response.ResponseError)를 감지해 로그로 남기고 빈 배열을 반환한다 — 이 형태를 감지하지 못하면 에러가 "0건 수집"으로 조용히 삼켜진다(라이브 검증 중 실제로 이 상태였음을 발견)', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            'nkoneps.com.response.ResponseError': {
              header: { resultCode: '08', resultMsg: '필수값 입력 에러' },
            },
          }),
      });
      global.fetch = mockFetch;
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const adapter = new G2BAnnouncementSourceAdapter('test-api-key');
      const results = await adapter.fetchLatest();

      expect(results).toEqual([]);
      errorSpy.mockRestore();
    });
  });
});
