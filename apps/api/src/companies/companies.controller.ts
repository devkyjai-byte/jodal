import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { CompaniesService, CompanyProfileResponse } from './companies.service';
import { UpdateRegionCodesDto } from './dto/update-region-codes.dto';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

/**
 * /companies/me — 프로필 읽기·지역 갱신 (02-04-PLAN.md).
 *
 * GET은 이전까지 없던 읽기 엔드포인트다 — gsd-plan-checker가 지적한 gap: PATCH만 있어
 * 지역 등록 후 재조회할 방법이 없었다. 이후 플랜(02-06 피드/상세, 02-07 알림설정)이
 * 업체 프로필을 읽어야 할 때 재사용할 수 있는 공용 조회 지점이다.
 */
@Controller('companies/me')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  getProfile(
    @Req() req: AuthenticatedRequest,
  ): Promise<CompanyProfileResponse> {
    return this.companiesService.getProfile(req.user.companyId);
  }

  /** PATCH /companies/me { regionCodes } — companies.region_codes 갱신 (PROF-02). */
  @Patch()
  updateRegionCodes(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateRegionCodesDto,
  ): Promise<{ regionCodes: string[] }> {
    return this.companiesService.updateRegionCodes(
      req.user.companyId,
      dto.regionCodes,
    );
  }
}
