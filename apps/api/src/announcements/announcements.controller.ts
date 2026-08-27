import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { AnnouncementsService, FeedResponseDto } from './announcements.service';
import { SearchQueryDto } from './dto/search-query.dto';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

/**
 * GET /feed(ING-04, CLIENT-01) — 02-06-PLAN.md Task 1.
 * JWT 가드로 보호되며, 조회 범위는 항상 로그인 업체로 스코프된다
 * (db-schema-design.md §Phase 2 인계 사항 5, T-01-12).
 * GET /announcements/:id(CLIENT-01)는 02-06 Task 2가 이 컨트롤러에 추가한다.
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
}
