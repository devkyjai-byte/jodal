import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/jwt.strategy';
import { CertificationsController } from './certifications.controller';
import { CompaniesService } from './companies.service';
import { AddCertificationDto } from './dto/add-certification.dto';

/**
 * CompaniesService를 모킹한 컨트롤러 단위 테스트 — performances.controller.spec.ts와 동일한
 * 사유(DB 없는 실행 환경)로 e2e 대신 단위 테스트로 컨트롤러 배선을 검증한다.
 */
describe('CertificationsController', () => {
  let controller: CertificationsController;
  const companiesService = {
    addCertification: jest.fn(),
    listCertifications: jest.fn(),
    deleteCertification: jest.fn(),
  };

  function req(companyId = 'company-1'): Request & { user: JwtPayload } {
    return { user: { companyId } } as Request & { user: JwtPayload };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CertificationsController],
      providers: [{ provide: CompaniesService, useValue: companiesService }],
    }).compile();

    controller = module.get<CertificationsController>(CertificationsController);
  });

  it('인증 등록 후 목록 조회 시 등록한 인증이 반환된다', async () => {
    companiesService.addCertification.mockResolvedValue({
      id: 'c1',
      certType: 'ISO 9001',
      certNumber: null,
      expiresAt: null,
    });
    companiesService.listCertifications.mockResolvedValue([
      { id: 'c1', certType: 'ISO 9001', certNumber: null, expiresAt: null },
    ]);

    const dto: AddCertificationDto = { certType: 'ISO 9001' };
    await controller.create(req(), dto);

    expect(companiesService.addCertification).toHaveBeenCalledWith(
      'company-1',
      dto,
    );

    const result = await controller.list(req());
    expect(result).toEqual([
      { id: 'c1', certType: 'ISO 9001', certNumber: null, expiresAt: null },
    ]);
  });

  it('삭제 시 소유권 검증을 서비스로 위임한다 (T-02-06)', async () => {
    companiesService.deleteCertification.mockResolvedValue(undefined);

    await controller.remove(req(), 'c1');

    expect(companiesService.deleteCertification).toHaveBeenCalledWith(
      'company-1',
      'c1',
    );
  });
});
