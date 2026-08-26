import { Module } from '@nestjs/common';
import { ConsoleEmailAdapter } from './adapters/console-email.adapter';
import { NotificationsService } from './notifications.service';
import { EMAIL_SENDER_PORT } from './ports/email-sender.port';

@Module({
  providers: [
    NotificationsService,
    { provide: EMAIL_SENDER_PORT, useClass: ConsoleEmailAdapter },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
