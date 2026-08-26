import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnnouncementsService } from './announcements.service';
import {
  ANNOUNCEMENT_SOURCE_PORT,
  type AnnouncementSourcePort,
} from './ports/announcement-source.port';
import { FixtureAnnouncementSourceAdapter } from './adapters/fixture-announcement-source.adapter';
import { G2BAnnouncementSourceAdapter } from './adapters/g2b-announcement-source.adapter';

/**
 * ANNOUNCEMENT_SOURCE 환경변수 값에 따라 활성 어댑터를 선택한다. 팩토리 프로바이더에서
 * 쓰는 순수 함수로 분리해, "g2b로 전환하지 않는 한 G2BAnnouncementSourceAdapter가 선택되지
 * 않는다"를 모듈 부트스트랩 없이 단위테스트로 직접 검증할 수 있게 한다.
 */
export function selectAnnouncementSource(
  configService: ConfigService,
): AnnouncementSourcePort {
  const source = configService.get<string>('ANNOUNCEMENT_SOURCE') ?? 'fixture';
  if (source === 'g2b') {
    return new G2BAnnouncementSourceAdapter(
      configService.get<string>('NARAJANGTEO_API_KEY') ?? '',
    );
  }
  return new FixtureAnnouncementSourceAdapter();
}

@Module({
  providers: [
    AnnouncementsService,
    {
      provide: ANNOUNCEMENT_SOURCE_PORT,
      useFactory: selectAnnouncementSource,
      inject: [ConfigService],
    },
  ],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
