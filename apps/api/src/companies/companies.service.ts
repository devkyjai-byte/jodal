import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompanyClassificationCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CompanyProfileResponse {
  id: string;
  companyName: string;
  contactEmail: string;
  regionCodes: string[];
  verificationStatus: string;
  classificationCodes: { id: string; classificationCode: string }[];
  profileComplete: boolean;
}

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  /** company_classification_codes 1행 생성. 자릿수/숫자 검증은 DTO + DB CHECK 제약이 담당. */
  addClassificationCode(
    companyId: string,
    code: string,
  ): Promise<CompanyClassificationCode> {
    return this.prisma.companyClassificationCode.create({
      data: {
        companyId,
        classificationCode: code,
      },
    });
  }

  /** GET /companies/me/classification-codes — 로그인 업체 소유 행만 조회 (T-02-06). */
  listClassificationCodes(
    companyId: string,
  ): Promise<CompanyClassificationCode[]> {
    return this.prisma.companyClassificationCode.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * DELETE /companies/me/classification-codes/:id — 소유권 검증 후 삭제.
   * T-02-06 위협 대응: 다른 업체 소유 행이면 403(존재하지 않으면 404).
   */
  async deleteClassificationCode(companyId: string, id: string): Promise<void> {
    const row = await this.prisma.companyClassificationCode.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('분류코드를 찾을 수 없습니다.');
    }
    if (row.companyId !== companyId) {
      throw new ForbiddenException(
        '본인 업체의 분류코드만 삭제할 수 있습니다.',
      );
    }
    await this.prisma.companyClassificationCode.delete({ where: { id } });
  }

  /**
   * GET /companies/me — 프로필 읽기 엔드포인트. 이전까지 PATCH만 있어 온보딩 화면이
   * 재조회할 방법이 없었던 기능 공백을 메운다(02-04-PLAN.md objective).
   * profileComplete = 업종 1개 이상 AND 지역 1개 이상 등록 시 true.
   */
  async getProfile(companyId: string): Promise<CompanyProfileResponse> {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      include: { classificationCodes: { orderBy: { createdAt: 'asc' } } },
    });

    return {
      id: company.id,
      companyName: company.companyName,
      contactEmail: company.contactEmail,
      regionCodes: company.regionCodes,
      verificationStatus: company.verificationStatus,
      classificationCodes: company.classificationCodes.map((c) => ({
        id: c.id,
        classificationCode: c.classificationCode,
      })),
      profileComplete:
        company.classificationCodes.length > 0 &&
        company.regionCodes.length > 0,
    };
  }

  /** PATCH /companies/me { regionCodes } — companies.region_codes 배열 컬럼 갱신 (PROF-02). */
  async updateRegionCodes(
    companyId: string,
    regionCodes: string[],
  ): Promise<{ regionCodes: string[] }> {
    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: { regionCodes },
    });
    return { regionCodes: updated.regionCodes };
  }
}
