import { Injectable } from '@nestjs/common';
import { CompanyClassificationCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
}
