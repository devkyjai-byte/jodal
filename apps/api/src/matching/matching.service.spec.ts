import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { MatchingService, scoreMatch } from './matching.service';

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

/**
 * 회귀 테스트 (02-REVIEW.md CR-01) — company.regionCodes와 announcement.regionCodes가
 * 동일한 표기(예: "서울특별시")를 쓸 때 지역 매칭 가점(+25)이 실제로 적용되는지 검증한다.
 * 기존 tracer.e2e-spec.ts는 score > 0만 확인해 분류코드 가점(60)만으로도 통과했기 때문에,
 * 픽스처 JSON이 숫자 지역코드("11")를 쓰고 있어 지역 가점이 한 번도 적용되지 않는 결함을
 * 잡아내지 못했다 — 이 스펙은 그 결함을 명시적으로 재현/차단한다.
 */
describe('scoreMatch — 지역 매칭 가점(+25)', () => {
  const baseCompany = {
    classificationCodes: [],
    hasPerformances: false,
    hasCertifications: false,
  };

  it('company.regionCodes와 announcement.regionCodes가 동일 표기로 겹치면 +25 가점이 적용된다', () => {
    const score = scoreMatch(
      { ...baseCompany, regionCodes: ['서울특별시'] },
      { classificationCode: null, regionCodes: ['서울특별시'] },
    );
    // classificationCode가 NULL이면 최소 20점 보장 + 지역 가점 25 = 45
    expect(score).toBe(45);
  });

  it('지역이 겹치지 않으면 지역 가점이 적용되지 않는다', () => {
    const score = scoreMatch(
      { ...baseCompany, regionCodes: ['서울특별시'] },
      { classificationCode: null, regionCodes: ['부산광역시'] },
    );
    expect(score).toBe(20); // classificationCode NULL 최소 보장 20점만, 지역 가점 없음
  });

  it('두 표기가 다르면(예: 전체 명칭 vs 숫자 코드) 문자열이 일치하지 않아 가점이 적용되지 않는다 — 표기 통일이 깨지면 이 테스트가 실패해야 한다', () => {
    const score = scoreMatch(
      { ...baseCompany, regionCodes: ['서울특별시'] },
      { classificationCode: null, regionCodes: ['11'] },
    );
    expect(score).toBe(20); // 표기 불일치 → 지역 가점 미적용(exact-string 계약 명시)
  });

  it('announcement.regionCodes가 빈 배열(전국)이면 부분 가점 +15가 적용된다', () => {
    const score = scoreMatch(
      { ...baseCompany, regionCodes: ['서울특별시'] },
      { classificationCode: null, regionCodes: [] },
    );
    expect(score).toBe(35); // 20(NULL 최소 보장) + 15(전국 부분 가점)
  });
});
