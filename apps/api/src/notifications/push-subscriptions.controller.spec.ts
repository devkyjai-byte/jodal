import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/jwt.strategy';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';
import { NotificationsService } from './notifications.service';
import { PushSubscriptionsController } from './push-subscriptions.controller';

/**
 * NotificationsService를 모킹한 컨트롤러 단위 테스트 — certifications.controller.spec.ts와
 * 동일한 사유(DB 없는 실행 환경)로 e2e 대신 단위 테스트로 컨트롤러 배선을 검증한다.
 */
describe('PushSubscriptionsController', () => {
  let controller: PushSubscriptionsController;
  const notificationsService = {
    upsertPushSubscription: jest.fn(),
    deletePushSubscription: jest.fn(),
  };

  function req(companyId = 'company-1'): Request & { user: JwtPayload } {
    return { user: { companyId } } as Request & { user: JwtPayload };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PushSubscriptionsController],
      providers: [
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    controller = module.get<PushSubscriptionsController>(
      PushSubscriptionsController,
    );
  });

  it('동일 endpoint로 재구독해도 서비스의 upsertPushSubscription으로 위임되어 행이 늘어나지 않는다(UPSERT)', async () => {
    notificationsService.upsertPushSubscription.mockResolvedValue({
      id: 'sub-1',
    });

    const dto: CreatePushSubscriptionDto = {
      endpoint: 'https://push.example.com/1',
      p256dh: 'p256dh-value',
      auth: 'auth-value',
    };

    const result = await controller.subscribe(req(), dto);

    expect(result).toEqual({ id: 'sub-1' });
    expect(notificationsService.upsertPushSubscription).toHaveBeenCalledWith(
      'company-1',
      dto,
    );

    // 동일 endpoint로 다시 호출해도 동일 서비스 메서드로 위임될 뿐, 컨트롤러가 별도
    // 행을 만들지 않는다 — 실제 UPSERT 여부는 NotificationsService.upsertPushSubscription()
    // (notifications.service.ts, Prisma UNIQUE(endpoint) 기준)이 보장한다.
    notificationsService.upsertPushSubscription.mockResolvedValue({
      id: 'sub-1',
    });
    const secondResult = await controller.subscribe(req(), dto);
    expect(secondResult).toEqual({ id: 'sub-1' });
    expect(notificationsService.upsertPushSubscription).toHaveBeenCalledTimes(
      2,
    );
  });

  it('삭제 시 소유권 검증을 서비스로 위임한다(T-02-15)', async () => {
    notificationsService.deletePushSubscription.mockResolvedValue(undefined);

    await controller.unsubscribe(req(), 'sub-1');

    expect(notificationsService.deletePushSubscription).toHaveBeenCalledWith(
      'company-1',
      'sub-1',
    );
  });

  it('다른 업체 소유의 구독 id로 DELETE 시도 시 서비스가 던진 403이 그대로 전파된다', async () => {
    class ForbiddenStub extends Error {
      status = 403;
    }
    notificationsService.deletePushSubscription.mockRejectedValue(
      new ForbiddenStub('본인 업체의 구독만 삭제할 수 있습니다.'),
    );

    await expect(
      controller.unsubscribe(req('company-2'), 'sub-owned-by-company-1'),
    ).rejects.toThrow('본인 업체의 구독만 삭제할 수 있습니다.');
  });
});
