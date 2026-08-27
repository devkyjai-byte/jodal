import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import {
  AnnouncementDetailResponseDto,
  AnnouncementsService,
  FeedResponseDto,
} from './announcements.service';
import { SearchQueryDto } from './dto/search-query.dto';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

/**
 * GET /feed(ING-04, CLIENT-01) + GET /announcements/:id(CLIENT-01) — 02-06-PLAN.md.
 * 두 엔드포인트 모두 JWT 가드로 보호되며, 조회 범위는 항상 로그인 업체로 스코프된다
 * (db-schema-design.md §Phase 2 인계 사항 5, T-01-12).
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get('feed')
  getFeed(
    @Req() req: AuthenticatedRequest,
    @Query() query: SearchQueryDto,
  ): Promise<FeedResponseDto> {
    return this.announcementsService.getFeed(req.user.companyId, query);
  }

  /**
   * match_id 쿼리 파라미터는 이메일 알림 링크 경로에서만 전달된다(00-user-journey.md
   * §화면 간 데이터 인계 계약). 소유권 불일치 시 announcementsService가 403을 던진다.
   */
  @Get('announcements/:id')
  getDetail(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('match_id') matchId?: string,
  ): Promise<AnnouncementDetailResponseDto> {
    return this.announcementsService.getDetail(req.user.companyId, id, matchId);
  }
}
