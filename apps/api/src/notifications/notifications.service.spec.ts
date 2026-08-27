import type { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

interface FakePushSubscriptionRow {
  id: string;
  companyId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** matching.service.spec.ts와 동일한 사유(DB 없는 실행 환경) — 인메모리 페이크 Prisma. */
function makeFakePrisma(initialRows: FakePushSubscriptionRow[] = []) {
  const rows: FakePushSubscriptionRow[] = [...initialRows];
  let idCounter = rows.length;

  const prisma = {
    pushSubscription: {
      upsert: ({
        where,
        create,
        update,
      }: {
        where: { endpoint: string };
        create: Omit<FakePushSubscriptionRow, 'id'>;
        update: Partial<FakePushSubscriptionRow>;
      }) => {
        let row = rows.find((r) => r.endpoint === where.endpoint);
        if (row) {
          Object.assign(row, update);
        } else {
          row = { id: `sub-${++idCounter}`, ...create };
          rows.push(row);
        }
        return Promise.resolve(row);
      },
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(rows.find((r) => r.id === where.id) ?? null),
      delete: ({ where }: { where: { id: string } }) => {
        const idx = rows.findIndex((r) => r.id === where.id);
        const [removed] = rows.splice(idx, 1);
        return Promise.resolve(removed);
      },
    },
  } as unknown as PrismaService;

  return { prisma, rows };
}

function makeService(prisma: PrismaService): NotificationsService {
  return new NotificationsService(prisma, {
    send: jest.fn().mockResolvedValue(undefined),
  });
}

describe('NotificationsService — push_subscriptions (MATCH-03)', () => {
  it('동일 endpoint로 재구독해도 행이 늘어나지 않는다(UPSERT)', async () => {
    const { prisma, rows } = makeFakePrisma();
    const service = makeService(prisma);

    await service.upsertPushSubscription('company-1', {
      endpoint: 'https://push.example.com/device-a',
      p256dh: 'p1',
      auth: 'a1',
    });
    await service.upsertPushSubscription('company-1', {
      endpoint: 'https://push.example.com/device-a',
      p256dh: 'p1-updated',
      auth: 'a1-updated',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].p256dh).toBe('p1-updated');
  });

  it('다른 업체 소유의 구독 id로 삭제 시도 시 403을 던진다', async () => {
    const { prisma } = makeFakePrisma([
      {
        id: 'sub-1',
        companyId: 'company-1',
        endpoint: 'https://push.example.com/device-a',
        p256dh: 'p1',
        auth: 'a1',
      },
    ]);
    const service = makeService(prisma);

    await expect(
      service.deletePushSubscription('company-2', 'sub-1'),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('존재하지 않는 구독 id 삭제 시도 시 404를 던진다', async () => {
    const { prisma } = makeFakePrisma();
    const service = makeService(prisma);

    await expect(
      service.deletePushSubscription('company-1', 'missing'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('본인 소유 구독 삭제는 정상 처리된다', async () => {
    const { prisma, rows } = makeFakePrisma([
      {
        id: 'sub-1',
        companyId: 'company-1',
        endpoint: 'https://push.example.com/device-a',
        p256dh: 'p1',
        auth: 'a1',
      },
    ]);
    const service = makeService(prisma);

    await service.deletePushSubscription('company-1', 'sub-1');

    expect(rows).toHaveLength(0);
  });
});
