import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/jwt.strategy';
import { NotificationLogsController } from './notification-logs.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationLogsController', () => {
  let controller: NotificationLogsController;
  const notificationsService = {
    listNotificationLogs: jest.fn(),
  };

  function req(companyId = 'company-1'): Request & { user: JwtPayload } {
    return { user: { companyId } } as Request & { user: JwtPayload };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationLogsController],
      providers: [
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    controller = module.get<NotificationLogsController>(
      NotificationLogsController,
    );
  });

  it('로그인 업체 companyId로 스코프된 발송 이력을 반환한다', async () => {
    const logs = [
      {
        id: 'log-1',
        channel: 'email',
        status: 'sent',
        sentAt: '2026-08-27T00:00:00.000Z',
        announcementTitle: '테스트 공고',
      },
    ];
    notificationsService.listNotificationLogs.mockResolvedValue(logs);

    const result = await controller.list(req());

    expect(result).toEqual(logs);
    expect(notificationsService.listNotificationLogs).toHaveBeenCalledWith(
      'company-1',
    );
  });
});
