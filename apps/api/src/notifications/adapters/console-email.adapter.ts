import { Injectable, Logger } from '@nestjs/common';
import { EmailMessage, EmailSenderPort } from '../ports/email-sender.port';

/**
 * 콘솔에 로그하고 즉시 resolve하는 개발용 어댑터. 02-07이 ResendEmailAdapter로 교체한다.
 */
@Injectable()
export class ConsoleEmailAdapter implements EmailSenderPort {
  private readonly logger = new Logger(ConsoleEmailAdapter.name);

  send(message: EmailMessage): Promise<void> {
    this.logger.log(
      `[email] to=${message.to} subject="${message.subject}"\n${message.body}`,
    );
    return Promise.resolve();
  }
}
