import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * POST /companies/me/certifications — db-schema-design.md `company_certifications`는
 * `cert_type` 외 NOT NULL 없음(02-04-PLAN.md 지시).
 */
export class AddCertificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  certType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  certNumber?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
