import { Module } from '@nestjs/common';
import { MatchingModule } from '../matching/matching.module';
import { CertificationsController } from './certifications.controller';
import { ClassificationCodesController } from './classification-codes.controller';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { PerformancesController } from './performances.controller';

@Module({
  imports: [MatchingModule],
  controllers: [
    ClassificationCodesController,
    CompaniesController,
    PerformancesController,
    CertificationsController,
  ],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
