import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { CompaniesService } from './companies.service';
import { AddPerformanceDto } from './dto/add-performance.dto';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

interface PerformanceResponse {
  id: string;
  projectName: string;
  contractAmount: string | null;
  contractDate: string | null;
  agencyName: string | null;
}

/**
 * /companies/me/performances — 01-onboarding.md 스텝 4(선택 입력). 사업명 외 NOT NULL 없음
 * (db-schema-design.md `company_performances`, 02-04-PLAN.md task 2 지시).
 */
@Controller('companies/me/performances')
@UseGuards(JwtAuthGuard)
export class PerformancesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AddPerformanceDto,
  ): Promise<PerformanceResponse> {
    const created = await this.companiesService.addPerformance(
      req.user.companyId,
      dto,
    );
    return {
      id: created.id,
      projectName: created.projectName,
      contractAmount: created.contractAmount?.toString() ?? null,
      contractDate: created.contractDate?.toISOString() ?? null,
      agencyName: created.agencyName,
    };
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest): Promise<PerformanceResponse[]> {
    const rows = await this.companiesService.listPerformances(
      req.user.companyId,
    );
    return rows.map((r) => ({
      id: r.id,
      projectName: r.projectName,
      contractAmount: r.contractAmount?.toString() ?? null,
      contractDate: r.contractDate?.toISOString() ?? null,
      agencyName: r.agencyName,
    }));
  }

  /** 소유권 검증(T-02-06) — 다른 업체 소유 행이면 403. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.companiesService.deletePerformance(req.user.companyId, id);
  }
}
