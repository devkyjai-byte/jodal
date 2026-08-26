import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
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
 * POST /companies/me/classification-codes — JWT 가드 적용.
 * 등록 직후 MatchingService.scoreAndUpsert(companyId)를 동기 호출한다
 * (02-02-PLAN.md key_links: classification-codes.controller.ts -> matching.service.ts).
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
}
