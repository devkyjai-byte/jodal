import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { MatchingService } from './matching.service';

interface FakeCompany {
  id: string;
  regionCodes: string[];
  classificationCodes: { classificationCode: string }[];
  performances: unknown[];
  certifications: unknown[];
}

interface FakeAnnouncement {
  id: string;
  classificationCode: string | null;
  regionCodes: string[];
}

interface FakeMatchRow {
  id: string;
  companyId: string;
  announcementId: string;
  score: unknown;
}

/**
 * PrismaService의 필요한 모델 서브셋만 구현하는 인메모리 페이크 — 이 실행 환경에
 * Docker/PostgreSQL이 없어(WINDOWS.md 기존 갭과 동일) scoreAndUpsertForAnnouncements()의
 * 후보 조회·스코어링·UPSERT 로직을 순수 단위테스트로 검증한다.
 */
function makeFakePrisma(fixtures: {
  announcements: FakeAnnouncement[];
  companies: FakeCompany[];
  companyClassificationCodeRows: {
    companyId: string;
    classificationCode: string;
  }[];
}) {
  const matchRows: FakeMatchRow[] = [];
  let matchIdCounter = 0;

  const prisma = {
    bidAnnouncement: {
      findMany: ({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(
          fixtures.announcements.filter((a) => where.id.in.includes(a.id)),
        ),
    },
    companyClassificationCode: {
      findMany: ({
        where,
      }: {
        where: { classificationCode: { in: string[] } };
      }) => {
        const seen = new Set<string>();
        const result: { companyId: string }[] = [];
        for (const row of fixtures.companyClassificationCodeRows) {
          if (
            where.classificationCode.in.includes(row.classificationCode) &&
            !seen.has(row.companyId)
          ) {
            seen.add(row.companyId);
            result.push({ companyId: row.companyId });
          }
        }
        return Promise.resolve(result);
      },
    },
    company: {
      findMany: () =>
        Promise.resolve(fixtures.companies.map((c) => ({ id: c.id }))),
      findUniqueOrThrow: ({ where }: { where: { id: string } }) => {
        const company = fixtures.companies.find((c) => c.id === where.id);
        if (!company) throw new Error(`company not found: ${where.id}`);
        return Promise.resolve(company);
      },
    },
    match: {
      upsert: ({
        where,
        create,
        update,
      }: {
        where: {
          companyId_announcementId: {
            companyId: string;
            announcementId: string;
          };
        };
        create: { companyId: string; announcementId: string; score: unknown };
        update: { score: unknown };
      }) => {
        const { companyId, announcementId } = where.companyId_announcementId;
        let row = matchRows.find(
          (r) =>
            r.companyId === companyId && r.announcementId === announcementId,
        );
        if (row) {
          row.score = update.score;
        } else {
          row = {
            id: `match-${++matchIdCounter}`,
            companyId,
            announcementId,
            score: create.score,
          };
          matchRows.push(row);
        }
        return Promise.resolve(row);
      },
    },
  } as unknown as PrismaService;

  return { prisma, matchRows };
}

function makeStubNotificationsService(): NotificationsService {
  return {
    sendMatchNotifications: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;
}

describe('MatchingService.scoreAndUpsertForAnnouncements (팬아웃 재매칭)', () => {
  it('신규 공고 1건(classification 43211501)을 수집한 뒤 43 또는 4321을 등록한 모든 업체에 대해서만 matches 행이 생성된다', async () => {
    const announcement: FakeAnnouncement = {
      id: 'ann-1',
      classificationCode: '43211501',
      regionCodes: [],
    };

    const companies: FakeCompany[] = [
      {
        id: 'company-a', // '43' 등록 — 후보여야 함
        regionCodes: [],
        classificationCodes: [{ classificationCode: '43' }],
        performances: [],
        certifications: [],
      },
      {
        id: 'company-b', // '4321' 등록 — 후보여야 함
        regionCodes: [],
        classificationCodes: [{ classificationCode: '4321' }],
        performances: [],
        certifications: [],
      },
      {
        id: 'company-c', // '44'(다른 대분류) 등록 — 후보가 아니어야 함
        regionCodes: [],
        classificationCodes: [{ classificationCode: '44' }],
        performances: [],
        certifications: [],
      },
      {
        id: 'company-d', // 등록된 분류코드 없음 — 후보가 아니어야 함
        regionCodes: [],
        classificationCodes: [],
        performances: [],
        certifications: [],
      },
    ];

    const companyClassificationCodeRows = companies.flatMap((c) =>
      c.classificationCodes.map((cc) => ({
        companyId: c.id,
        classificationCode: cc.classificationCode,
      })),
    );

    const { prisma, matchRows } = makeFakePrisma({
      announcements: [announcement],
      companies,
      companyClassificationCodeRows,
    });

    const service = new MatchingService(prisma, makeStubNotificationsService());
    const { matchIds } = await service.scoreAndUpsertForAnnouncements([
      'ann-1',
    ]);

    expect(matchIds).toHaveLength(2); // 정확히 43/4321 등록 업체 수만큼
    const matchedCompanyIds = matchRows.map((r) => r.companyId).sort();
    expect(matchedCompanyIds).toEqual(['company-a', 'company-b']);
  });

  it('classification_code가 NULL인 공고도 matches에 후보로 남는다(완전 배제되지 않고 점수 >= 20)', async () => {
    const announcement: FakeAnnouncement = {
      id: 'ann-null',
      classificationCode: null,
      regionCodes: [],
    };

    const companies: FakeCompany[] = [
      {
        id: 'company-x',
        regionCodes: [],
        classificationCodes: [{ classificationCode: '55' }],
        performances: [],
        certifications: [],
      },
      {
        id: 'company-y',
        regionCodes: [],
        classificationCodes: [], // 등록된 분류코드가 없어도 NULL 공고는 후보에서 제외되지 않음
        performances: [],
        certifications: [],
      },
    ];

    const { prisma, matchRows } = makeFakePrisma({
      announcements: [announcement],
      companies,
      companyClassificationCodeRows: [
        { companyId: 'company-x', classificationCode: '55' },
      ],
    });

    const service = new MatchingService(prisma, makeStubNotificationsService());
    const { matchIds } = await service.scoreAndUpsertForAnnouncements([
      'ann-null',
    ]);

    expect(matchIds).toHaveLength(2); // 전체 업체가 후보로 남음(완전 배제 없음)
    for (const row of matchRows) {
      expect(Number(row.score)).toBeGreaterThanOrEqual(20);
    }
  });

  it('announcementIds가 빈 배열이면 즉시 빈 결과를 반환한다', async () => {
    const { prisma } = makeFakePrisma({
      announcements: [],
      companies: [],
      companyClassificationCodeRows: [],
    });
    const service = new MatchingService(prisma, makeStubNotificationsService());
    const result = await service.scoreAndUpsertForAnnouncements([]);
    expect(result).toEqual({ matchIds: [] });
  });
});
