import { IsString, Matches } from 'class-validator';

/**
 * db-schema-design.md §스파인이 강제하는 설계 제약 (a) — 자릿수 2/4/6/8, 숫자만.
 * DB CHECK 제약(chk_ccc_classification_code_length/_numeric)과 동일한 규칙을
 * API 레이어에서도 검증한다(ASVS V5, RESEARCH.md Security Domain).
 */
export class AddClassificationCodeDto {
  @IsString()
  @Matches(/^(\d{2}|\d{4}|\d{6}|\d{8})$/, {
    message: 'classification code는 2/4/6/8자리 숫자여야 합니다.',
  })
  code!: string;
}
