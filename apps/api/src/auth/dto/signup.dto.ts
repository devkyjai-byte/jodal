import {
  IsBoolean,
  IsEmail,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

/**
 * ASVS V5 Input Validation — 01-onboarding.md 스텝 1 필드와 1:1 대응.
 * 사업자등록번호 체크섬 검증은 형식만으로 판단 불가하므로 AuthService에서 별도 수행한다
 * (business-reg-no.crypto.ts의 isValidBusinessRegNoFormat).
 */
export class SignupDto {
  @IsString()
  @Length(10, 10, { message: '사업자등록번호는 10자리여야 합니다.' })
  businessRegNo!: string;

  @IsString()
  @MinLength(1, { message: '업체명을 입력해주세요.' })
  companyName!: string;

  @IsEmail({}, { message: '이메일 형식이 올바르지 않습니다.' })
  contactEmail!: string;

  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  password!: string;

  /** 01-onboarding.md 엣지 케이스 — 개인정보 수집·이용 동의 미체크 시 가입 차단(서버 측 방어선). */
  @IsBoolean()
  privacyConsent!: boolean;
}
