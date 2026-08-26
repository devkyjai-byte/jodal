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
import { MatchingService } from '../matching/matching.service';
import { CompaniesService } from './companies.service';
import { AddClassificationCodeDto } from './dto/add-classification-code.dto';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

/**
 * /companies/me/classification-codes — JWT 가드 적용. 02-04-PLAN.md가 GET(목록)/DELETE(소유권
 * 검증)를 추가해 온보딩 스텝 2(업종 다중 선택)가 등록·조회·삭제를 전부 실제 API로 수행하게 한다.
 */
@Controller('companies/me/classification-codes')
@UseGuards(JwtAuthGuard)
export class ClassificationCodesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly matchingService: MatchingService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AddClassificationCodeDto,
  ): Promise<{ id: string; classificationCode: string }> {
    const companyId = req.user.companyId;

    const created = await this.companiesService.addClassificationCode(
      companyId,
      dto.code,
    );

    // 등록 직후 동기 스코어링 — 새 matches가 생기면 내부에서 알림 발송까지 이어진다
    // (matching.service.ts -> notifications.service.ts).
    await this.matchingService.scoreAndUpsert(companyId);

    return {
      id: created.id,
      classificationCode: created.classificationCode,
    };
  }

  /** GET /companies/me/classification-codes — 로그인 업체가 등록한 분류코드 전체 목록. */
  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ id: string; classificationCode: string }[]> {
    const rows = await this.companiesService.listClassificationCodes(
      req.user.companyId,
    );
    return rows.map((r) => ({
      id: r.id,
      classificationCode: r.classificationCode,
    }));
  }

  /**
   * DELETE /companies/me/classification-codes/:id — 소유권 검증(T-02-06).
   * 다른 업체 소유 행을 삭제 시도하면 403.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<void> {
    await this.companiesService.deleteClassificationCode(
      req.user.companyId,
      id,
    );
  }
}
