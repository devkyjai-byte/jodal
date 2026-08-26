/**
 * 이메일 발송 포트 — 02-02는 ConsoleEmailAdapter만 구현한다. 02-07이 이 인터페이스를
 * 그대로 두고 ResendEmailAdapter로 어댑터만 교체한다(아키텍처 변경 없음, 02-02-PLAN.md 명시).
 */
export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailSenderPort {
  send(message: EmailMessage): Promise<void>;
}

/** NestJS DI 토큰 — 인터페이스는 런타임에 존재하지 않으므로 Symbol로 주입한다. */
export const EMAIL_SENDER_PORT = Symbol('EMAIL_SENDER_PORT');
