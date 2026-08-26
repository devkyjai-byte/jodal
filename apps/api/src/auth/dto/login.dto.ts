import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * ASVS V5 Input Validation — POST /auth/login. 사업자등록번호 대신 이메일을 1차 로그인
 * 식별자로 채택한 이유는 auth.service.ts의 login() 문서 주석 참고(02-03-PLAN.md 지시).
 */
export class LoginDto {
  @IsEmail({}, { message: '이메일 형식이 올바르지 않습니다.' })
  email!: string;

  @IsString()
  @MinLength(1, { message: '비밀번호를 입력해주세요.' })
  password!: string;
}
