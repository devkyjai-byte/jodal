import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import type { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt.strategy';
import type { MeilisearchService } from '../search/meilisearch.service';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import type { AnnouncementSourcePort } from './ports/announcement-source.port';

/**
 * GET /feed(ING-04) + GET /announcements/:id(CLIENT-01) 검증 — 02-06-PLAN.md.
 *
 * 이 실행 환경에 Docker/PostgreSQL이 없어(WINDOWS.md #1/#3/#4와 동일 갭) 실DB 대신
 * PrismaService의 match/bidAnnouncement/company 모델 서브셋만 구현하는 인메모리 페이크로
 * AnnouncementsService.getFeed()/getDetail()의 필터링·정렬·소유권 검증 로직을 검증한다.
 * Meilisearch도 실제 서버 없이 mock으로 대체한다.
 */

interface FakeCompany {
  id: string;
  regionCodes: string[];
  classificationCodes: { id: string; classificationCode: string }[];
}

interface FakeAnnouncement {
  id: string;
  sourceBidNo: string;
  sourceRevisionNo: string;
  isLatestRevision: boolean;
  title: string;
  classificationCode: string | null;
  regionCodes: string[];
  agencyName: string | null;
  budgetAmount: number | null;
  bidOpenAt: Date | null;
  bidCloseAt: Date | null;
  fetchedAt: Date;
}

interface FakeMatch {
  id: string;
  companyId: string;
  announcementId: string;
  score: number;
  matchedAt: Date;
}

function makeFakePrisma(opts: {
  companies: FakeCompany[];
  announcements: FakeAnnouncement[];
  matches: FakeMatch[];
}): PrismaService {
  const { companies, announcements, matches } = opts;
  const announcementsById = new Map(announcements.map((a) => [a.id, a]));
  const companiesById = new Map(companies.map((c) => [c.id, c]));

  const match = {
    findMany: ({ where }: { where: { companyId: string } }) => {
      const rows = matches
        .filter((m) => m.companyId === where.companyId)
        .map((m) => ({
          ...m,
          announcement: announcementsById.get(m.announcementId),
        }));
      return Promise.resolve(rows);
    },
    findUnique: ({
      where,
    }: {
      where: {
        id?: string;
        companyId_announcementId?: {
          companyId: string;
          announcementId: string;
        };
      };
    }) => {
      if (where.id) {
        return Promise.resolve(matches.find((m) => m.id === where.id) ?? null);
      }
      if (where.companyId_announcementId) {
        const { companyId, announcementId } = where.companyId_announcementId;
        return Promise.resolve(
          matches.find(
            (m) =>
              m.companyId === companyId && m.announcementId === announcementId,
          ) ?? null,
        );
      }
      return Promise.resolve(null);
    },
  };

  const bidAnnouncement = {
    findUnique: ({ where }: { where: { id: string } }) =>
      Promise.resolve(announcementsById.get(where.id) ?? null),
    findFirst: ({
      where,
    }: {
      where: { sourceBidNo: string; isLatestRevision: boolean };
    }) =>
      Promise.resolve(
        announcements.find(
          (a) =>
            a.sourceBidNo === where.sourceBidNo &&
            a.isLatestRevision === where.isLatestRevision,
        ) ?? null,
      ),
  };

  const companyModel = {
    findUniqueOrThrow: ({ where }: { where: { id: string } }) => {
      const c = companiesById.get(where.id);
      if (!c) throw new Error(`fake company not found: ${where.id}`);
      return Promise.resolve(c);
    },
  };

  return {
    match,
    bidAnnouncement,
    company: companyModel,
  } as unknown as PrismaService;
}

function makeFakeSearchService(
  searchAnnouncementIds: jest.Mock = jest.fn().mockResolvedValue([]),
): MeilisearchService {
  return {
    indexAnnouncement: jest.fn().mockResolvedValue(undefined),
    searchAnnouncementIds,
  } as unknown as MeilisearchService;
}

function makeSourcePort(): AnnouncementSourcePort {
  return { fetchLatest: () => Promise.resolve([]) };
}

function req(companyId: string): Request & { user: JwtPayload } {
  return { user: { companyId } } as Request & { user: JwtPayload };
}

const now = new Date();
const future = (days: number) =>
  new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
const past = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

function buildFixtures() {
  const companies: FakeCompany[] = [
    {
      id: 'company-a',
      regionCodes: ['서울특별시'],
      classificationCodes: [{ id: 'cc1', classificationCode: '43' }],
    },
    {
      id: 'company-b',
      regionCodes: [],
      classificationCodes: [{ id: 'cc2', classificationCode: '44' }],
    },
  ];

  const announcements: FakeAnnouncement[] = [
    {
      id: 'ann-1',
      sourceBidNo: 'B1',
      sourceRevisionNo: '0',
      isLatestRevision: true,
      title: '2026년 컴퓨터 유지보수',
      classificationCode: '43211501',
      regionCodes: ['서울특별시'],
      agencyName: '서울시청',
      budgetAmount: 10000000,
      bidOpenAt: past(5),
      bidCloseAt: future(10),
      fetchedAt: now,
    },
    {
      id: 'ann-2',
      sourceBidNo: 'B2',
      sourceRevisionNo: '0',
      isLatestRevision: true,
      title: '사무용품 납품',
      classificationCode: '44121511',
      regionCodes: [],
      agencyName: '조달청',
      budgetAmount: 5000000,
      bidOpenAt: past(5),
      bidCloseAt: future(10),
      fetchedAt: past(1),
    },
    {
      id: 'ann-3',
      sourceBidNo: 'B3',
      sourceRevisionNo: '0',
      isLatestRevision: true,
      title: '만료된 정보시스템 공고',
      classificationCode: '43211501',
      regionCodes: ['부산광역시'],
      agencyName: '부산시청',
      budgetAmount: 3000000,
      bidOpenAt: past(20),
      bidCloseAt: past(1),
      fetchedAt: past(20),
    },
    {
      id: 'ann-4',
      sourceBidNo: 'B4',
      sourceRevisionNo: '0',
      isLatestRevision: true,
      title: '부산 정보통신 공고',
      classificationCode: '43211501',
      regionCodes: ['부산광역시'],
      agencyName: '부산시청',
      budgetAmount: 4000000,
      bidOpenAt: past(3),
      bidCloseAt: future(20),
      fetchedAt: past(2),
    },
    {
      id: 'ann-5',
      sourceBidNo: 'B5',
      sourceRevisionNo: '0',
      isLatestRevision: false,
      title: '개정 전 공고',
      classificationCode: '43211501',
      regionCodes: ['서울특별시'],
      agencyName: '서울시청',
      budgetAmount: 1000000,
      bidOpenAt: past(30),
      bidCloseAt: future(5),
      fetchedAt: past(30),
    },
    {
      id: 'ann-6',
      sourceBidNo: 'B5',
      sourceRevisionNo: '1',
      isLatestRevision: true,
      title: '개정된 공고(최신)',
      classificationCode: '43211501',
      regionCodes: ['서울특별시'],
      agencyName: '서울시청',
      budgetAmount: 1200000,
      bidOpenAt: past(2),
      bidCloseAt: future(15),
      fetchedAt: past(2),
    },
    {
      id: 'ann-7',
      sourceBidNo: 'B7',
      sourceRevisionNo: '0',
      isLatestRevision: true,
      title: '이번 주 마감 임박 공고',
      classificationCode: '43211501',
      regionCodes: ['서울특별시'],
      agencyName: '서울시청',
      budgetAmount: 2000000,
      bidOpenAt: past(1),
      bidCloseAt: future(3),
      fetchedAt: past(1),
    },
  ];

  const matches: FakeMatch[] = [
    {
      id: 'match-a1',
      companyId: 'company-a',
      announcementId: 'ann-1',
      score: 90,
      matchedAt: now,
    },
    {
      id: 'match-a3',
      companyId: 'company-a',
      announcementId: 'ann-3',
      score: 60,
      matchedAt: past(20),
    },
    {
      id: 'match-a4',
      companyId: 'company-a',
      announcementId: 'ann-4',
      score: 55,
      matchedAt: past(2),
    },
    {
      id: 'match-b2',
      companyId: 'company-b',
      announcementId: 'ann-2',
      score: 70,
      matchedAt: past(1),
    },
    {
      id: 'match-a7',
      companyId: 'company-a',
      announcementId: 'ann-7',
      score: 65,
      matchedAt: past(1),
    },
  ];

  return { companies, announcements, matches };
}

function makeController(searchAnnouncementIds?: jest.Mock) {
  const { companies, announcements, matches } = buildFixtures();
  const prisma = makeFakePrisma({ companies, announcements, matches });
  const searchService = makeFakeSearchService(searchAnnouncementIds);
  const service = new AnnouncementsService(
    prisma,
    makeSourcePort(),
    searchService,
  );
  const controller = new AnnouncementsController(service);
  return { controller, searchService };
}

describe('AnnouncementsController', () => {
  describe('GET /feed', () => {
    it('기본 조회(필터 없음) 시 로그인 업체(company-a)의 매칭만, 마감 지난 공고는 제외하고 반환한다', async () => {
      const { controller } = makeController();
      const result = await controller.getFeed(req('company-a'), {});

      expect(result.items.map((i) => i.id)).toEqual([
        'ann-1',
        'ann-7',
        'ann-4',
      ]);
    });

    it('GET /feed 응답 JSON 어디에도 score/원점수 숫자 필드가 없다', async () => {
      const { controller } = makeController();
      const result = await controller.getFeed(req('company-a'), {});

      expect(result.items.length).toBeGreaterThan(0);
      for (const item of result.items) {
        expect(Object.keys(item)).not.toContain('score');
        expect(item).toHaveProperty('qualitativeTier');
      }
    });

    it('region=서울특별시 필터 시 해당 지역 미포함 공고(ann-4, 부산광역시)가 결과에서 빠진다', async () => {
      const { controller } = makeController();
      const result = await controller.getFeed(req('company-a'), {
        region: ['서울특별시'],
      });

      expect(result.items.map((i) => i.id)).toEqual(['ann-1', 'ann-7']);
    });

    it('includeExpired=true면 마감된 공고(ann-3)도 포함되고 isExpired=true로 표시된다', async () => {
      const { controller } = makeController();
      const result = await controller.getFeed(req('company-a'), {
        includeExpired: true,
      });

      expect(result.items.map((i) => i.id)).toEqual([
        'ann-1',
        'ann-7',
        'ann-3',
        'ann-4',
      ]);
      const expiredItem = result.items.find((i) => i.id === 'ann-3')!;
      expect(expiredItem.isExpired).toBe(true);
    });

    it('classification=44 필터 시 회사의 공고(모두 43211501)가 결과에서 전부 빠진다', async () => {
      const { controller } = makeController();
      const result = await controller.getFeed(req('company-a'), {
        classification: ['44'],
      });

      expect(result.items).toEqual([]);
    });

    it('classification=43 필터 시 43로 시작하는 공고만 유지된다', async () => {
      const { controller } = makeController();
      const result = await controller.getFeed(req('company-a'), {
        classification: ['43'],
      });

      expect(result.items.map((i) => i.id)).toEqual([
        'ann-1',
        'ann-7',
        'ann-4',
      ]);
    });

    it('deadline=this_week 필터 시 7일 이내 마감 공고(ann-7)만 남는다', async () => {
      const { controller } = makeController();
      const result = await controller.getFeed(req('company-a'), {
        deadline: 'this_week',
      });

      expect(result.items.map((i) => i.id)).toEqual(['ann-7']);
    });

    it('keyword가 있으면 Meilisearch 후보 id로 먼저 좁힌 뒤 matches와 교집합을 취한다', async () => {
      const searchAnnouncementIds = jest.fn().mockResolvedValue(['ann-1']);
      const { controller } = makeController(searchAnnouncementIds);
      const result = await controller.getFeed(req('company-a'), {
        keyword: '컴퓨터',
      });

      expect(searchAnnouncementIds).toHaveBeenCalledWith('컴퓨터');
      expect(result.items.map((i) => i.id)).toEqual(['ann-1']);
    });

    it('키워드 검색 결과가 0건이면 즉시 빈 목록을 반환한다', async () => {
      const searchAnnouncementIds = jest.fn().mockResolvedValue([]);
      const { controller } = makeController(searchAnnouncementIds);
      const result = await controller.getFeed(req('company-a'), {
        keyword: '없는키워드',
      });

      expect(result.items).toEqual([]);
    });

    it('다른 업체(company-b)의 JWT로 조회하면 자신의 matches 범위만 반환된다(교차 노출 없음)', async () => {
      const { controller } = makeController();
      const result = await controller.getFeed(req('company-b'), {});

      expect(result.items.map((i) => i.id)).toEqual(['ann-2']);
    });

    it('매칭 근거 문구가 일치한 prefix와 업종명을 포함한다', async () => {
      const { controller } = makeController();
      const result = await controller.getFeed(req('company-a'), {});

      const ann1 = result.items.find((i) => i.id === 'ann-1')!;
      expect(ann1.matchReason).toBe(
        '정보통신·소프트웨어개발(43) 업종 등록과 일치',
      );
    });
  });

  describe('GET /announcements/:id', () => {
    it('정상 조회 시 raw_payload 없이 정규화된 필드와 매칭 근거를 반환한다', async () => {
      const { controller } = makeController();
      const result = await controller.getDetail(req('company-a'), 'ann-1');

      expect(result.found).toBe(true);
      expect(result).not.toHaveProperty('rawPayload');
      expect(result.matchFound).toBe(true);
      expect(result.matchedPrefix).toBe('43');
      expect(result.regionMatched).toBe(true);
    });

    it('다른 업체 소유의 match_id로 상세 조회 시 403(ForbiddenException)이 발생한다', async () => {
      const { controller } = makeController();

      await expect(
        controller.getDetail(req('company-a'), 'ann-2', 'match-b2'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('존재하지 않는(취소·삭제된) 공고는 404 대신 found:false를 반환한다', async () => {
      const { controller } = makeController();
      const result = await controller.getDetail(req('company-a'), 'no-such-id');

      expect(result).toEqual({ found: false });
    });

    it('개정된 공고(ann-5)는 latestRevisionId로 최신 차수(ann-6)를 가리킨다', async () => {
      const { controller } = makeController();
      const result = await controller.getDetail(req('company-a'), 'ann-5');

      expect(result.isLatestRevision).toBe(false);
      expect(result.latestRevisionId).toBe('ann-6');
    });
  });
});
