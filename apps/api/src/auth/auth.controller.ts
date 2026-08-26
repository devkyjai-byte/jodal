import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService, SignupResult } from './auth.service';
import { SignupDto } from './dto/signup.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** POST /auth/signup — 201 + JWT. 로그인(POST /auth/login)은 02-03 범위. */
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  signup(@Body() dto: SignupDto): Promise<SignupResult> {
    return this.authService.signup(dto);
  }
}
