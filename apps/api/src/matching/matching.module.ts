import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { MatchingService } from './matching.service';

@Module({
  imports: [NotificationsModule],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
