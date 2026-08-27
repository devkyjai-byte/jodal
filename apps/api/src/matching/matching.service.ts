import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export type QualitativeTier = '매우 적합' | '적합' | '보통' | '낮음' | '참고용';

interface CompanyProfileForScoring {
  classificationCodes: string[];
  regionCodes: string[];
  hasPerformances: boolean;
  hasCertifications: boolean;
}

interface AnnouncementForScoring {
  classificationCode: string | null;
  regionCodes: string[];
}

/**
 * 02-RESEARCH.md §Code Examples MATCH-01 스코어링 함수 그대로 구현.
 * 최대 100점: 분류코드 prefix 일치(60) + 지역 일치(25) + 실적/인증 보조신호(15).
 * [ASSUMED] 이 수식은 실데이터 검증이 없는 제안값 — RESEARCH.md Assumption A1 참고.
 * notification_settings.min_score_threshold로 사용자가 보정 가능(안전망 존재).
 */
export function scoreMatch(
  company: CompanyProfileForScoring,
  announcement: AnnouncementForScoring,
): number {
  let score = 0;

  const bestMatchLength = company.classificationCodes
    .filter((code) => announcement.classificationCode?.startsWith(code))
    .reduce((max, code) => Math.max(max, code.length), 0);
  const prefixScoreTable: Record<number, number> = {
    8: 60,
    6: 45,
    4: 30,
    2: 15,
    0: 0,
  };
  score += prefixScoreTable[bestMatchLength] ?? 0;

  // 분류코드가 비어 있는 공고를 완전 배제하지 않는다(db-schema-design.md §스파인이
  // 강제하는 설계 제약 (c)). 이 브랜치는 이 서비스의 후보 조회 쿼리(prefix 리터럴 OR절)가
  // NULL 분류코드 공고를 이미 걸러내는 한 실행되지 않는다 — 키워드 매치 경로(검색엔진,
  // 향후 ING-04)가 별도로 이 값을 재사용할 수 있도록 함수 자체는 RESEARCH.md 원안대로 둔다.
  if (!announcement.classificationCode) {
    score = Math.max(score, 20);
  }

  const regionOverlap = company.regionCodes.some((r) =>
    announcement.regionCodes.includes(r),
  );
  if (announcement.regionCodes.length === 0) {
    score += 15; // 전국 공고(지역 제한 없음) — 부분 가점
  } else if (regionOverlap) {
    score += 25;
  }

  if (company.hasPerformances) score += 10;
  if (company.hasCertifications) score += 5;

  return Math.min(score, 100);
}

/**
 * 5단계 정성 등급 매핑. 매칭 점수(원점수)는 API 응답에 절대 그대로 노출하지 않는다 —
 * 등급 문자열로만 변환해 반환한다(Legal 제약 — 낙찰 보장 등 표현 금지와 직결).
 */
export function toQualitativeTier(score: number): QualitativeTier {
  if (score >= 85) return '매우 적합';
  if (score >= 70) return '적합';
  if (score >= 55) return '보통';
  if (score >= 35) return '낮음';
  return '참고용';
}

@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * 업체가 등록한 분류코드 prefix로 시작하는 공고를 리터럴 OR절로 조회해(db-schema-design.md
   * §스파인이 강제하는 설계 제약 (b) 권장안 — varchar_pattern_ops 인덱스 활용) matches를
   * UPSERT하고, 새/갱신된 매칭이 있으면 NotificationsService.sendMatchNotifications를
   * 동기 호출한다(02-02-PLAN.md key_links).
   */
  async scoreAndUpsert(companyId: string): Promise<{ matchIds: string[] }> {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      include: {
        classificationCodes: true,
        performances: { take: 1 },
        certifications: { take: 1 },
      },
    });

    const prefixes = company.classificationCodes.map(
      (c) => c.classificationCode,
    );
    if (prefixes.length === 0) {
      return { matchIds: [] };
    }

    // Prisma의 `startsWith`는 바인드 파라미터로 완성된 리터럴 패턴('prefix%')을 전달한다 —
    // 컬럼 대 컬럼 조인이 아니므로 varchar_pattern_ops 인덱스 레인지 스캔을 탈 수 있다.
    // classificationCode가 NULL인 공고(실제 나라장터 API — getBidPblancListInfoServc는
    // 물품분류번호를 제공하지 않음이 라이브 검증으로 확인됨, deferred-items.md 참고)도
    // 후보에 포함한다 — findCandidateCompanyIds()(팬아웃 재매칭 경로)는 이미 이렇게
    // 동작하고 있었는데, 이 동기 재계산 경로만 빠뜨려 "신규 공고가 들어올 때는 보이지만
    // 새로 가입해 재계산할 때는 안 보이는" 순서 의존적 비대칭이 있었다.
    const announcements = await this.prisma.bidAnnouncement.findMany({
      where: {
        OR: [
          ...prefixes.map((prefix) => ({
            classificationCode: { startsWith: prefix },
          })),
          { classificationCode: null },
        ],
      },
    });

    const companyProfile: CompanyProfileForScoring = {
      classificationCodes: prefixes,
      regionCodes: company.regionCodes,
      hasPerformances: company.performances.length > 0,
      hasCertifications: company.certifications.length > 0,
    };

    const matchIds: string[] = [];
    for (const announcement of announcements) {
      const score = scoreMatch(companyProfile, {
        classificationCode: announcement.classificationCode,
        regionCodes: announcement.regionCodes,
      });

      const match = await this.prisma.match.upsert({
        where: {
          companyId_announcementId: {
            companyId,
            announcementId: announcement.id,
          },
        },
        create: {
          companyId,
          announcementId: announcement.id,
          score: new Prisma.Decimal(score),
        },
        update: {
          score: new Prisma.Decimal(score),
        },
      });
      matchIds.push(match.id);
    }

    if (matchIds.length > 0) {
      await this.notificationsService.sendMatchNotifications(companyId);
    }

    return { matchIds };
  }

  /**
   * 팬아웃 재매칭 — 배치 수집으로 새로 upsert된 공고들에 대해 등록 업체 전체를 대상으로
   * matches를 재계산한다(MATCH-01 완성, 02-05-PLAN.md Task 2). scoreAndUpsert()(단일 업체
   * 버전, 02-02)와 동일한 scoreMatch/toQualitativeTier를 재사용해 아키텍처를 바꾸지 않는다.
   *
   * 조회 방향이 scoreAndUpsert()와 반대다 — 여기서는 "공고 1건에 대해 어떤 업체들이
   * 후보인가"를 물어야 한다. 공고의 classification_code에서 2/4/6/8자리 prefix를 모두
   * 전개해 company_classification_codes.classification_code IN (...) 리터럴 OR절로
   * 조회한다(db-schema-design.md §스파인이 강제하는 설계 제약 (b) 권장안의 반대 방향
   * 적용 — 여전히 리터럴 상수 조회이므로 인덱스를 탈 수 있다).
   */
  async scoreAndUpsertForAnnouncements(
    announcementIds: string[],
  ): Promise<{ matchIds: string[] }> {
    if (announcementIds.length === 0) {
      return { matchIds: [] };
    }

    const announcements = await this.prisma.bidAnnouncement.findMany({
      where: { id: { in: announcementIds } },
    });

    const matchIds: string[] = [];

    for (const announcement of announcements) {
      const candidateCompanyIds = await this.findCandidateCompanyIds(
        announcement.classificationCode,
      );

      for (const companyId of candidateCompanyIds) {
        const company = await this.prisma.company.findUniqueOrThrow({
          where: { id: companyId },
          include: {
            classificationCodes: true,
            performances: { take: 1 },
            certifications: { take: 1 },
          },
        });

        const companyProfile: CompanyProfileForScoring = {
          classificationCodes: company.classificationCodes.map(
            (c) => c.classificationCode,
          ),
          regionCodes: company.regionCodes,
          hasPerformances: company.performances.length > 0,
          hasCertifications: company.certifications.length > 0,
        };

        const score = scoreMatch(companyProfile, {
          classificationCode: announcement.classificationCode,
          regionCodes: announcement.regionCodes,
        });

        const match = await this.prisma.match.upsert({
          where: {
            companyId_announcementId: {
              companyId,
              announcementId: announcement.id,
            },
          },
          create: {
            companyId,
            announcementId: announcement.id,
            score: new Prisma.Decimal(score),
          },
          update: {
            score: new Prisma.Decimal(score),
          },
        });
        matchIds.push(match.id);
      }
    }

    return { matchIds };
  }

  /**
   * 공고의 classification_code(있다면) prefix가 등록된 업체를 리터럴 IN절로 조회한다.
   * classification_code가 NULL인 공고는 매칭에서 완전히 제외하지 않고 전체 업체를
   * 후보로 남긴다(scoreMatch()가 고정 20점을 부여) — §스파인이 강제하는 설계 제약 (c).
   */
  private async findCandidateCompanyIds(
    classificationCode: string | null,
  ): Promise<string[]> {
    if (!classificationCode) {
      const allCompanies = await this.prisma.company.findMany({
        select: { id: true },
      });
      return allCompanies.map((c) => c.id);
    }

    const prefixCandidates = [2, 4, 6, 8]
      .filter((len) => len <= classificationCode.length)
      .map((len) => classificationCode.slice(0, len));

    const matches = await this.prisma.companyClassificationCode.findMany({
      where: { classificationCode: { in: prefixCandidates } },
      select: { companyId: true },
      distinct: ['companyId'],
    });
    return matches.map((m) => m.companyId);
  }
}
