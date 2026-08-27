import {
  Body,
  Controller,
  Delete,
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
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';
import { NotificationsService } from './notifications.service';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

/**
 * POST/DELETE /push-subscriptions — 웹 푸시 구독 등록·해지(MATCH-03, 02-07 Task2).
 * 소유권 검증(T-02-15)은 NotificationsService.deletePushSubscription()이 담당한다
 * (certifications.controller.ts와 동일한 컨트롤러-서비스 분리 관례).
 */
@Controller('push-subscriptions')
@UseGuards(JwtAuthGuard)
export class PushSubscriptionsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async subscribe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePushSubscriptionDto,
  ): Promise<{ id: string }> {
    const subscription = await this.notificationsService.upsertPushSubscription(
      req.user.companyId,
      dto,
    );
    return { id: subscription.id };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribe(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<void> {
    await this.notificationsService.deletePushSubscription(
      req.user.companyId,
      id,
    );
  }
}
