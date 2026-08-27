import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import {
  NotificationLogResponse,
  NotificationsService,
} from './notifications.service';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

/**
 * GET /notification-logs — 알림 설정 화면 "최근 발송 이력 보기"(04-notification-settings.md
 * §레이아웃)의 데이터 소스. matches.company_id로 항상 스코프된 조회만 반환한다(T-02-17).
 */
@Controller('notification-logs')
@UseGuards(JwtAuthGuard)
export class NotificationLogsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest): Promise<NotificationLogResponse[]> {
    return this.notificationsService.listNotificationLogs(req.user.companyId);
  }
}
