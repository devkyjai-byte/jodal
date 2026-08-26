import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { CompaniesService } from './companies.service';
import { AddCertificationDto } from './dto/add-certification.dto';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

interface CertificationResponse {
  id: string;
  certType: string;
  certNumber: string | null;
  expiresAt: string | null;
}

/**
 * /companies/me/certifications — 01-onboarding.md 스텝 4(선택 입력). 종류 외 NOT NULL 없음
 * (db-schema-design.md `company_certifications`, 02-04-PLAN.md task 2 지시).
 */
@Controller('companies/me/certifications')
@UseGuards(JwtAuthGuard)
export class CertificationsController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AddCertificationDto,
  ): Promise<CertificationResponse> {
    const created = await this.companiesService.addCertification(
      req.user.companyId,
      dto,
    );
    return {
      id: created.id,
      certType: created.certType,
      certNumber: created.certNumber,
      expiresAt: created.expiresAt?.toISOString() ?? null,
    };
  }

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
  ): Promise<CertificationResponse[]> {
    const rows = await this.companiesService.listCertifications(
      req.user.companyId,
    );
    return rows.map((r) => ({
      id: r.id,
      certType: r.certType,
      certNumber: r.certNumber,
      expiresAt: r.expiresAt?.toISOString() ?? null,
    }));
  }

  /** 소유권 검증(T-02-06) — 다른 업체 소유 행이면 403. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<void> {
    await this.companiesService.deleteCertification(req.user.companyId, id);
  }
}
