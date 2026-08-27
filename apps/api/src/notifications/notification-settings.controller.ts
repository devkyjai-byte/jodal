import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { NotificationSettingsPreviewQueryDto } from './dto/notification-settings-preview-query.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import {
  NotificationSettingsResponse,
  NotificationsService,
} from './notifications.service';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

/**
 * GET/PATCH /notification-settings + GET /notification-settings/preview —
 * 04-notification-settings.md 화면 전체(CLIENT-01)의 데이터 소스. 모든 조회·갱신은
 * JWT의 companyId로만 스코프된다(T-02-17 — 타 업체가 변경 불가).
 */
@Controller('notification-settings')
@UseGuards(JwtAuthGuard)
export class NotificationSettingsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  get(@Req() req: AuthenticatedRequest): Promise<NotificationSettingsResponse> {
    return this.notificationsService.getSettingsResponse(req.user.companyId);
  }

  @Patch()
  patch(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsResponse> {
    return this.notificationsService.updateSettings(req.user.companyId, dto);
  }

  @Get('preview')
  async preview(
    @Req() req: AuthenticatedRequest,
    @Query() query: NotificationSettingsPreviewQueryDto,
  ): Promise<{ count: number }> {
    const count = await this.notificationsService.previewCount(
      req.user.companyId,
      query.threshold,
    );
    return { count };
  }
}
