import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/jwt.strategy';
import { CompaniesService } from './companies.service';
import { AddPerformanceDto } from './dto/add-performance.dto';
import { PerformancesController } from './performances.controller';

/**
 * CompaniesService를 모킹한 컨트롤러 단위 테스트 — DB 연결 없이 컨트롤러 배선(요청 →
 * 서비스 호출 → 응답 매핑)만 검증한다. e2e(DB 필요)는 tracer.e2e-spec.ts 계열이 담당하며
 * 이 실행 환경에는 DB가 없어(WINDOWS.md #1/#3) 단위 테스트로 대체 검증한다.
 */
describe('PerformancesController', () => {
  let controller: PerformancesController;
  const companiesService = {
    addPerformance: jest.fn(),
    listPerformances: jest.fn(),
    deletePerformance: jest.fn(),
  };

  function req(companyId = 'company-1'): Request & { user: JwtPayload } {
    return { user: { companyId } } as Request & { user: JwtPayload };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PerformancesController],
      providers: [{ provide: CompaniesService, useValue: companiesService }],
    }).compile();

    controller = module.get<PerformancesController>(PerformancesController);
  });

  it('실적 2건 등록 후 목록 조회 시 2건 반환', async () => {
    companiesService.addPerformance
      .mockResolvedValueOnce({
        id: 'p1',
        projectName: '사업 A',
        contractAmount: null,
        contractDate: null,
        agencyName: null,
      })
      .mockResolvedValueOnce({
        id: 'p2',
        projectName: '사업 B',
        contractAmount: null,
        contractDate: null,
        agencyName: null,
      });
    companiesService.listPerformances.mockResolvedValue([
      {
        id: 'p1',
        projectName: '사업 A',
        contractAmount: null,
        contractDate: null,
        agencyName: null,
      },
      {
        id: 'p2',
        projectName: '사업 B',
        contractAmount: null,
        contractDate: null,
        agencyName: null,
      },
    ]);

    const dtoA: AddPerformanceDto = { projectName: '사업 A' };
    const dtoB: AddPerformanceDto = { projectName: '사업 B' };
    await controller.create(req(), dtoA);
    await controller.create(req(), dtoB);

    expect(companiesService.addPerformance).toHaveBeenCalledTimes(2);
    expect(companiesService.addPerformance).toHaveBeenNthCalledWith(
      1,
      'company-1',
      dtoA,
    );

    const result = await controller.list(req());
    expect(result.length).toBe(2);
    expect(result.map((r) => r.projectName)).toEqual(['사업 A', '사업 B']);
  });

  it('건너뛰기 시(등록 0건) 목록 조회는 빈 배열을 반환한다', async () => {
    companiesService.listPerformances.mockResolvedValue([]);

    const result = await controller.list(req());

    expect(result).toEqual([]);
  });

  it('삭제 시 소유권 검증을 서비스로 위임한다 (T-02-06)', async () => {
    companiesService.deletePerformance.mockResolvedValue(undefined);

    await controller.remove(req(), 'p1');

    expect(companiesService.deletePerformance).toHaveBeenCalledWith(
      'company-1',
      'p1',
    );
  });
});
