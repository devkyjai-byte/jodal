import { Module } from '@nestjs/common';
import { MatchingModule } from '../matching/matching.module';
import { ClassificationCodesController } from './classification-codes.controller';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [MatchingModule],
  controllers: [ClassificationCodesController, CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
