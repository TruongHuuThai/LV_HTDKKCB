import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { CurrentUserPayload } from './current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) { }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto.TK_SDT, dto.TK_PASS);
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.auth.registerPatient({
      TK_SDT: dto.TK_SDT,
      TK_PASS: dto.TK_PASS,
      BN_HO_CHU_LOT: dto.BN_HO_CHU_LOT,
      BN_TEN: dto.BN_TEN,
      BN_EMAIL: dto.BN_EMAIL,
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: CurrentUserPayload) {
    return this.auth.me(user.TK_SDT);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refresh_token);
  }

  @Post('logout')
  async logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refresh_token);
  }

  @Put('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ChangePasswordDto
  ) {
    return this.auth.changePassword(user.TK_SDT, dto.old_password, dto.new_password);
  }
}
