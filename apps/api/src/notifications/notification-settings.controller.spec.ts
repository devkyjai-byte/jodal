import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/jwt.strategy';
import { isWithinQuietHours } from './notify.processor';
import { NotificationSettingsController } from './notification-settings.controller';
import {
  NotificationsService,
  NotificationSettingsResponse,
} from './notifications.service';
import type { PrismaService } from '../prisma/prisma.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

interface FakeNotificationSettingRow {
  companyId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  minScoreThreshold: unknown;
  digestFrequency: string;
  quietHoursStart: Date | null;
  quietHoursEnd: Date | null;
  deadlineReminderEnabled: boolean;
  deadlineReminderDays: number;
}

interface FakeNotificationLogRow {
  channel: string;
  status: string;
  updatedAt: Date;
  matchId: string;
}

/** matching.service.spec.ts와 동일한 사유(DB 없는 실행 환경) — 인메모리 페이크 Prisma. */
function makeFakePrisma(
  settingsRow: FakeNotificationSettingRow,
  logs: FakeNotificationLogRow[] = [],
) {
  const settings = { ...settingsRow };

  const prisma = {
    notificationSetting: {
      findUniqueOrThrow: ({ where }: { where: { companyId: string } }) => {
        if (where.companyId !== settings.companyId) {
          throw new Error('not found');
        }
        return Promise.resolve({ ...settings });
      },
      update: ({
        where,
        data,
      }: {
        where: { companyId: string };
        data: Partial<FakeNotificationSettingRow>;
      }) => {
        if (where.companyId !== settings.companyId) {
          throw new Error('not found');
        }
        Object.assign(settings, data);
        return Promise.resolve({ ...settings });
      },
    },
    notificationLog: {
      findMany: ({
        where,
        orderBy,
        take,
      }: {
        where: { channel: string; match: { companyId: string } };
        orderBy: { updatedAt: 'desc' };
        take: number;
      }) => {
        void orderBy;
        const filtered = logs
          .filter(
            (l) =>
              l.channel === where.channel &&
              l.matchId.startsWith(where.match.companyId),
          )
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .slice(0, take);
        return Promise.resolve(filtered);
      },
    },
    match: {
      count: () => Promise.resolve(0),
    },
  } as unknown as PrismaService;

  return { prisma, settings };
}

function makeDefaultSettingsRow(
  companyId = 'company-1',
): FakeNotificationSettingRow {
  return {
    companyId,
    emailEnabled: true,
    pushEnabled: false,
    minScoreThreshold: 60,
    digestFrequency: 'immediate',
    quietHoursStart: null,
    quietHoursEnd: null,
    deadlineReminderEnabled: true,
    deadlineReminderDays: 3,
  };
}

describe('NotificationsService — 알림 설정(CLIENT-01)', () => {
  it('이메일 토글을 끈 뒤 GET으로 재조회하면 email_enabled: false가 즉시 반영된다', async () => {
    const { prisma } = makeFakePrisma(makeDefaultSettingsRow());
    const service = new NotificationsService(prisma, {
      send: jest.fn().mockResolvedValue(undefined),
    });

    await service.updateSettings('company-1', { emailEnabled: false });
    const result = await service.getSettingsResponse('company-1');

    expect(result.emailEnabled).toBe(false);
  });

  it('bounceWarning은 이메일 채널 최근 3건이 모두 failed일 때만 true다', async () => {
    const failingLogs: FakeNotificationLogRow[] = [
      {
        channel: 'email',
        status: 'failed',
        updatedAt: new Date(3000),
        matchId: 'company-1-m3',
      },
      {
        channel: 'email',
        status: 'failed',
        updatedAt: new Date(2000),
        matchId: 'company-1-m2',
      },
      {
        channel: 'email',
        status: 'failed',
        updatedAt: new Date(1000),
        matchId: 'company-1-m1',
      },
    ];
    const { prisma } = makeFakePrisma(makeDefaultSettingsRow(), failingLogs);
    const service = new NotificationsService(prisma, {
      send: jest.fn().mockResolvedValue(undefined),
    });

    const result = await service.getSettingsResponse('company-1');
    expect(result.bounceWarning).toBe(true);
  });

  it('최근 3건 중 1건이라도 sent면 bounceWarning은 false다', async () => {
    const mixedLogs: FakeNotificationLogRow[] = [
      {
        channel: 'email',
        status: 'sent',
        updatedAt: new Date(3000),
        matchId: 'company-1-m3',
      },
      {
        channel: 'email',
        status: 'failed',
        updatedAt: new Date(2000),
        matchId: 'company-1-m2',
      },
      {
        channel: 'email',
        status: 'failed',
        updatedAt: new Date(1000),
        matchId: 'company-1-m1',
      },
    ];
    const { prisma } = makeFakePrisma(makeDefaultSettingsRow(), mixedLogs);
    const service = new NotificationsService(prisma, {
      send: jest.fn().mockResolvedValue(undefined),
    });

    const result = await service.getSettingsResponse('company-1');
    expect(result.bounceWarning).toBe(false);
  });

  it('실패 로그가 2건뿐이면(3건 미만) bounceWarning은 false다', async () => {
    const twoFailures: FakeNotificationLogRow[] = [
      {
        channel: 'email',
        status: 'failed',
        updatedAt: new Date(2000),
        matchId: 'company-1-m2',
      },
      {
        channel: 'email',
        status: 'failed',
        updatedAt: new Date(1000),
        matchId: 'company-1-m1',
      },
    ];
    const { prisma } = makeFakePrisma(makeDefaultSettingsRow(), twoFailures);
    const service = new NotificationsService(prisma, {
      send: jest.fn().mockResolvedValue(undefined),
    });

    const result = await service.getSettingsResponse('company-1');
    expect(result.bounceWarning).toBe(false);
  });

  it('방해금지 종료 시각이 시작 시각보다 이르면 자정을 넘기는 구간으로 저장된다', async () => {
    const { prisma } = makeFakePrisma(makeDefaultSettingsRow());
    const service = new NotificationsService(prisma, {
      send: jest.fn().mockResolvedValue(undefined),
    });

    const dto: UpdateNotificationSettingsDto = {
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    };
    const result = await service.updateSettings('company-1', dto);

    // 저장값 자체는 입력 그대로 왕복된다 — "자정을 넘기는 구간으로 해석"은 저장 형식
    // 변환이 아니라 조회 시점(notify.processor.ts#isWithinQuietHours)의 의미 해석이다.
    expect(result.quietHoursStart).toBe('22:00');
    expect(result.quietHoursEnd).toBe('07:00');

    // 저장된 22:00~07:00 쌍이 실제로 자정을 넘기는 구간으로 해석되는지 순수 함수로 검증.
    expect(isWithinQuietHours(23 * 60, 22 * 60, 7 * 60)).toBe(true); // 23:00 — 구간 안
    expect(isWithinQuietHours(12 * 60, 22 * 60, 7 * 60)).toBe(false); // 정오 — 구간 밖
  });

  it('quietHoursStart에 null을 보내면 미설정으로 되돌린다', async () => {
    const initial = makeDefaultSettingsRow();
    initial.quietHoursStart = new Date(Date.UTC(1970, 0, 1, 22, 0, 0));
    initial.quietHoursEnd = new Date(Date.UTC(1970, 0, 1, 7, 0, 0));
    const { prisma } = makeFakePrisma(initial);
    const service = new NotificationsService(prisma, {
      send: jest.fn().mockResolvedValue(undefined),
    });

    const result = await service.updateSettings('company-1', {
      quietHoursStart: null,
      quietHoursEnd: null,
    });

    expect(result.quietHoursStart).toBeNull();
    expect(result.quietHoursEnd).toBeNull();
  });

  it('PATCH는 명시된 필드만 갱신하고 나머지는 유지한다(부분 갱신)', async () => {
    const { prisma } = makeFakePrisma(makeDefaultSettingsRow());
    const service = new NotificationsService(prisma, {
      send: jest.fn().mockResolvedValue(undefined),
    });

    const result = await service.updateSettings('company-1', {
      deadlineReminderDays: 7,
    });

    expect(result.deadlineReminderDays).toBe(7);
    expect(result.emailEnabled).toBe(true); // 기본값 유지
    expect(result.digestFrequency).toBe('immediate'); // 기본값 유지
  });
});

describe('NotificationSettingsController — 컨트롤러 배선', () => {
  let controller: NotificationSettingsController;
  const notificationsService = {
    getSettingsResponse: jest.fn(),
    updateSettings: jest.fn(),
    previewCount: jest.fn(),
  };

  function req(companyId = 'company-1'): Request & { user: JwtPayload } {
    return { user: { companyId } } as Request & { user: JwtPayload };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationSettingsController],
      providers: [
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    controller = module.get<NotificationSettingsController>(
      NotificationSettingsController,
    );
  });

  it('GET은 서비스로 companyId를 위임한다', async () => {
    const response: NotificationSettingsResponse = {
      emailEnabled: true,
      pushEnabled: false,
      minScoreThreshold: 60,
      digestFrequency: 'immediate',
      quietHoursStart: null,
      quietHoursEnd: null,
      deadlineReminderEnabled: true,
      deadlineReminderDays: 3,
      bounceWarning: false,
    };
    notificationsService.getSettingsResponse.mockResolvedValue(response);

    const result = await controller.get(req());

    expect(result).toEqual(response);
    expect(notificationsService.getSettingsResponse).toHaveBeenCalledWith(
      'company-1',
    );
  });

  it('PATCH는 dto와 companyId를 그대로 서비스로 위임한다', async () => {
    notificationsService.updateSettings.mockResolvedValue({});
    const dto: UpdateNotificationSettingsDto = { emailEnabled: false };

    await controller.patch(req(), dto);

    expect(notificationsService.updateSettings).toHaveBeenCalledWith(
      'company-1',
      dto,
    );
  });

  it('GET preview는 threshold를 서비스로 전달하고 count를 감싸 반환한다', async () => {
    notificationsService.previewCount.mockResolvedValue(5);

    const result = await controller.preview(req(), { threshold: 70 });

    expect(result).toEqual({ count: 5 });
    expect(notificationsService.previewCount).toHaveBeenCalledWith(
      'company-1',
      70,
    );
  });
});
