import {
  IsDateString,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * POST /companies/me/performances — db-schema-design.md `company_performances`는
 * `project_name` 외 NOT NULL 없음(02-04-PLAN.md 지시). 계약금액은 Prisma Decimal(15,0)
 * 컬럼과 짝을 맞추기 위해 숫자 문자열로 받는다.
 */
export class AddPerformanceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  projectName!: string;

  @IsOptional()
  @IsNumberString()
  contractAmount?: string;

  @IsOptional()
  @IsDateString()
  contractDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  agencyName?: string;
}
