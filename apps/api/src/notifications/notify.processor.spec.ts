import type { ConfigService } from '@nestjs/config';
import type { Job, Queue } from 'bullmq';
import type { PrismaService } from '../prisma/prisma.service';
import { ResendEmailAdapter } from './adapters/resend-email.adapter';
import { ConsoleEmailAdapter } from './adapters/console-email.adapter';
import {
  DispatchableMatch,
  NotifyProcessor,
  computeDelayToQuietHoursEndMs,
  dateToMinutesOfDay,
  isWithinQuietHours,
} from './notify.processor';
import { NotificationsService } from './notifications.service';
import { selectEmailAdapter } from './notifications.module';

interface FakeNotificationLogRow {
  matchId: string;
  channel: string;
  status: string;
  sentAt: Date | null;
  errorMessage: string | null;
}

/** matching.service.spec.ts와 동일한 사유(DB 없는 실행 환경) — 인메모리 페이크 Prisma. */
function makeFakePrisma(initialLogs: FakeNotificationLogRow[] = []) {
  const logs: FakeNotificationLogRow[] = [...initialLogs];

  const prisma = {
    notificationLog: {
      upsert: ({
        where,
        create,
        update,
      }: {
        where: { matchId_channel: { matchId: string; channel: string } };
        create: Partial<FakeNotificationLogRow> & {
          matchId: string;
          channel: string;
        };
        update: Partial<FakeNotificationLogRow>;
      }) => {
        const { matchId, channel } = where.matchId_channel;
        let row = logs.find(
          (l) => l.matchId === matchId && l.channel === channel,
        );
        if (row) {
          Object.assign(row, update);
        } else {
          row = {
            matchId,
            channel,
            status: create.status ?? 'pending',
            sentAt: create.sentAt ?? null,
            errorMessage: create.errorMessage ?? null,
          };
          logs.push(row);
        }
        return Promise.resolve(row);
      },
    },
  } as unknown as PrismaService;

  return { prisma, logs };
}

function makeEmailSenderStub() {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

/**
 * `add`를 별도로 반환하는 이유: `notifyQueue.add`를 Queue 타입 변수에서 직접 참조하면
 * `@typescript-eslint/unbound-method`가 걸린다(Queue가 실제 클래스 타입이라 메서드 참조로
 * 오인됨) — jest.fn() 자체를 별도 참조로 들고 있으면 이 문제를 피할 수 있다.
 */
function makeQueueStub(): { queue: Queue; add: jest.Mock } {
  const add = jest.fn().mockResolvedValue(undefined);
  return { queue: { add } as unknown as Queue, add };
}

function makeMatch(
  overrides: Partial<DispatchableMatch> = {},
): DispatchableMatch {
  return {
    id: 'match-1',
    announcement: { title: '테스트 공고' },
    notificationLogs: [],
    company: {
      companyName: '테스트업체',
      contactEmail: 'test@example.com',
      notificationSettings: {
        emailEnabled: true,
        pushEnabled: false,
        digestFrequency: 'immediate',
        quietHoursStart: null,
        quietHoursEnd: null,
      },
    },
    ...overrides,
  };
}

function makeJob(matchIds: string[]): Job<{ matchIds: string[] }> {
  return { data: { matchIds } } as unknown as Job<{ matchIds: string[] }>;
}

describe('NotifyProcessor — 이메일 발송 멱등성', () => {
  it('동일 matchId로 dispatch-notifications 잡을 두 번 실행해도 notification_logs 행이 1개만 존재한다', async () => {
    const emailSender = makeEmailSenderStub();
    const { prisma, logs } = makeFakePrisma();
    const notificationsService = new NotificationsService(prisma, emailSender);
    const { queue: notifyQueue } = makeQueueStub();
    const processor = new NotifyProcessor(
      prisma,
      notificationsService,
      notifyQueue,
    );

    const match = makeMatch();
    (prisma as unknown as { match: { findMany: unknown } }).match = {
      findMany: jest.fn().mockResolvedValue([match]),
    };

    await processor.process(makeJob([match.id]));
    // 두 번째 실행 시에는 findMany가 첫 실행에서 만들어진 로그를 포함해 반환해야
    // 실제 재시도 상황(다음 잡 실행 시 이미 로그가 존재)을 재현한다.
    const matchWithLog = makeMatch({
      notificationLogs: [{ channel: 'email' }],
    });
    (prisma as unknown as { match: { findMany: unknown } }).match = {
      findMany: jest.fn().mockResolvedValue([matchWithLog]),
    };
    await processor.process(makeJob([match.id]));

    const emailLogs = logs.filter(
      (l) => l.matchId === match.id && l.channel === 'email',
    );
    expect(emailLogs).toHaveLength(1);
    expect(emailSender.send).toHaveBeenCalledTimes(1);
  });

  it('EMAIL_ADAPTER=console이면 실제 Resend API가 호출되지 않는다(테스트 환경 안전)', () => {
    const configService = {
      get: jest.fn().mockReturnValue(undefined), // EMAIL_ADAPTER 미설정 → 기본값 console
    } as unknown as ConfigService;

    const adapter = selectEmailAdapter(configService);

    expect(adapter).toBeInstanceOf(ConsoleEmailAdapter);
    expect(adapter).not.toBeInstanceOf(ResendEmailAdapter);
  });

  it('EMAIL_ADAPTER=resend + RESEND_API_KEY가 있으면 ResendEmailAdapter가 선택된다(생성만, 네트워크 호출 없음)', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'EMAIL_ADAPTER') return 'resend';
        if (key === 'RESEND_API_KEY') return 're_test_fake_key';
        return undefined;
      }),
    } as unknown as ConfigService;

    const adapter = selectEmailAdapter(configService);

    expect(adapter).toBeInstanceOf(ResendEmailAdapter);
  });
});

describe('NotifyProcessor — 방해금지 시간대', () => {
  it('현재 시각이 방해금지 구간 안이면 발송하지 않고 종료 시각으로 재예약한다(delay 검증)', async () => {
    const emailSender = makeEmailSenderStub();
    const { prisma, logs } = makeFakePrisma();
    const notificationsService = new NotificationsService(prisma, emailSender);
    const { queue: notifyQueue, add: notifyQueueAdd } = makeQueueStub();
    const processor = new NotifyProcessor(
      prisma,
      notificationsService,
      notifyQueue,
    );

    // 현재 시각을 UTC 23:00으로 고정 — 방해금지 22:00~07:00(자정 넘김) 구간 안.
    const fixedNow = new Date(Date.UTC(2026, 0, 1, 23, 0, 0));
    jest.useFakeTimers().setSystemTime(fixedNow);

    const match = makeMatch({
      company: {
        companyName: '테스트업체',
        contactEmail: 'test@example.com',
        notificationSettings: {
          emailEnabled: true,
          pushEnabled: false,
          digestFrequency: 'immediate',
          quietHoursStart: new Date(Date.UTC(1970, 0, 1, 22, 0, 0)),
          quietHoursEnd: new Date(Date.UTC(1970, 0, 1, 7, 0, 0)),
        },
      },
    });
    (prisma as unknown as { match: { findMany: unknown } }).match = {
      findMany: jest.fn().mockResolvedValue([match]),
    };

    await processor.process(makeJob([match.id]));

    expect(emailSender.send).not.toHaveBeenCalled();
    expect(logs).toHaveLength(0); // 방해금지 구간에서는 로그도 남기지 않는다(재예약만)
    expect(notifyQueueAdd).toHaveBeenCalledTimes(1);
    // 23:00 → 07:00까지 8시간 = 8 * 60 * 60 * 1000ms
    expect(notifyQueueAdd).toHaveBeenCalledWith(
      'dispatch-notifications',
      { matchIds: [match.id] },
      { delay: 8 * 60 * 60 * 1000 },
    );

    jest.useRealTimers();
  });

  it('방해금지 시간대가 아니면 정상 발송한다', async () => {
    const emailSender = makeEmailSenderStub();
    const { prisma } = makeFakePrisma();
    const notificationsService = new NotificationsService(prisma, emailSender);
    const { queue: notifyQueue, add: notifyQueueAdd } = makeQueueStub();
    const processor = new NotifyProcessor(
      prisma,
      notificationsService,
      notifyQueue,
    );

    const fixedNow = new Date(Date.UTC(2026, 0, 1, 12, 0, 0)); // 정오 — 방해금지 밖
    jest.useFakeTimers().setSystemTime(fixedNow);

    const match = makeMatch({
      company: {
        companyName: '테스트업체',
        contactEmail: 'test@example.com',
        notificationSettings: {
          emailEnabled: true,
          pushEnabled: false,
          digestFrequency: 'immediate',
          quietHoursStart: new Date(Date.UTC(1970, 0, 1, 22, 0, 0)),
          quietHoursEnd: new Date(Date.UTC(1970, 0, 1, 7, 0, 0)),
        },
      },
    });
    (prisma as unknown as { match: { findMany: unknown } }).match = {
      findMany: jest.fn().mockResolvedValue([match]),
    };

    await processor.process(makeJob([match.id]));

    expect(emailSender.send).toHaveBeenCalledTimes(1);
    expect(notifyQueueAdd).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});

describe('NotifyProcessor — 발송 조건', () => {
  it('email_enabled가 false면 발송하지 않는다', async () => {
    const emailSender = makeEmailSenderStub();
    const { prisma } = makeFakePrisma();
    const notificationsService = new NotificationsService(prisma, emailSender);
    const { queue: notifyQueue } = makeQueueStub();
    const processor = new NotifyProcessor(
      prisma,
      notificationsService,
      notifyQueue,
    );

    const match = makeMatch({
      company: {
        companyName: '테스트업체',
        contactEmail: 'test@example.com',
        notificationSettings: {
          emailEnabled: false,
          pushEnabled: false,
          digestFrequency: 'immediate',
          quietHoursStart: null,
          quietHoursEnd: null,
        },
      },
    });
    (prisma as unknown as { match: { findMany: unknown } }).match = {
      findMany: jest.fn().mockResolvedValue([match]),
    };

    await processor.process(makeJob([match.id]));

    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("digest_frequency='daily_digest'면 즉시 발송하지 않고 pending 로그만 남긴다", async () => {
    const emailSender = makeEmailSenderStub();
    const { prisma, logs } = makeFakePrisma();
    const notificationsService = new NotificationsService(prisma, emailSender);
    const { queue: notifyQueue } = makeQueueStub();
    const processor = new NotifyProcessor(
      prisma,
      notificationsService,
      notifyQueue,
    );

    const match = makeMatch({
      company: {
        companyName: '테스트업체',
        contactEmail: 'test@example.com',
        notificationSettings: {
          emailEnabled: true,
          pushEnabled: false,
          digestFrequency: 'daily_digest',
          quietHoursStart: null,
          quietHoursEnd: null,
        },
      },
    });
    (prisma as unknown as { match: { findMany: unknown } }).match = {
      findMany: jest.fn().mockResolvedValue([match]),
    };

    await processor.process(makeJob([match.id]));

    expect(emailSender.send).not.toHaveBeenCalled();
    expect(logs).toEqual([
      {
        matchId: match.id,
        channel: 'email',
        status: 'pending',
        sentAt: null,
        errorMessage: null,
      },
    ]);
  });
});

describe('quiet-hours 순수 함수', () => {
  it('dateToMinutesOfDay는 UTC 시:분을 분 단위로 변환한다', () => {
    expect(dateToMinutesOfDay(new Date(Date.UTC(2026, 0, 1, 1, 30)))).toBe(90);
  });

  it('isWithinQuietHours: 자정을 넘기지 않는 구간', () => {
    // 09:00~18:00
    expect(isWithinQuietHours(10 * 60, 9 * 60, 18 * 60)).toBe(true);
    expect(isWithinQuietHours(19 * 60, 9 * 60, 18 * 60)).toBe(false);
  });

  it('isWithinQuietHours: 자정을 넘기는 구간(22:00~07:00)', () => {
    expect(isWithinQuietHours(23 * 60, 22 * 60, 7 * 60)).toBe(true);
    expect(isWithinQuietHours(3 * 60, 22 * 60, 7 * 60)).toBe(true);
    expect(isWithinQuietHours(12 * 60, 22 * 60, 7 * 60)).toBe(false);
  });

  it('start === end면 방해금지 없음으로 취급', () => {
    expect(isWithinQuietHours(10 * 60, 9 * 60, 9 * 60)).toBe(false);
  });

  it('computeDelayToQuietHoursEndMs: 자정을 넘기지 않는 경우', () => {
    expect(computeDelayToQuietHoursEndMs(10 * 60, 18 * 60)).toBe(
      8 * 60 * 60 * 1000,
    );
  });

  it('computeDelayToQuietHoursEndMs: 자정을 넘기는 경우', () => {
    expect(computeDelayToQuietHoursEndMs(23 * 60, 7 * 60)).toBe(
      8 * 60 * 60 * 1000,
    );
  });
});
