import { Body, Controller, Get, HttpCode, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';
import { OtpPurpose } from '@prisma/client';
import { AuthService } from './auth.service';
import { AuthenticatedUser, JwtAuthGuard } from './auth.guard';

const iranianPhone = /^09\d{9}$/;
const canonicalEmail = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value;

class RegisterDto {
  @Matches(iranianPhone) phoneNumber!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsString() @MinLength(10) password!: string;
  @Transform(canonicalEmail) @IsOptional() @IsEmail() email?: string;
}
class LoginDto { @Matches(iranianPhone) phoneNumber!: string; @IsString() password!: string; }
class SendOtpDto { @Matches(iranianPhone) phoneNumber!: string; }
class VerifyOtpDto { @Matches(iranianPhone) phoneNumber!: string; @Matches(/^\d{6}$/) otp!: string; }
class RefreshDto { @IsString() @MinLength(32) refreshToken!: string; }
class ResetPasswordDto extends VerifyOtpDto { @IsString() @MinLength(10) newPassword!: string; }
class ChangePasswordDto { @IsString() currentPassword!: string; @IsString() @MinLength(10) newPassword!: string; }
class UpdateProfileDto { @IsOptional() @IsString() @Length(2, 120) name?: string; @Transform(canonicalEmail) @IsOptional() @IsEmail() email?: string; @IsOptional() @IsString() avatar?: string; }

@ApiTags('Authentication')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() body: RegisterDto) { return this.auth.register(body); }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto, @Req() request: any) { return this.auth.login(body.phoneNumber, body.password, this.metadata(request)); }

  @Post('otp/send')
  @HttpCode(200)
  sendLoginOtp(@Body() body: SendOtpDto) { return this.auth.sendOtp(body.phoneNumber, OtpPurpose.LOGIN); }

  @Post('otp/verify')
  @HttpCode(200)
  verifyLoginOtp(@Body() body: VerifyOtpDto, @Req() request: any) { return this.auth.verifyLoginOtp(body.phoneNumber, body.otp, this.metadata(request)); }

  @Post('password/forgot')
  @HttpCode(200)
  forgotPassword(@Body() body: SendOtpDto) { return this.auth.sendOtp(body.phoneNumber, OtpPurpose.PASSWORD_RESET); }

  @Post('password/reset')
  @HttpCode(200)
  async resetPassword(@Body() body: ResetPasswordDto) { await this.auth.resetPassword(body.phoneNumber, body.otp, body.newPassword); return { message: 'Password reset successfully' }; }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: RefreshDto, @Req() request: any) { return this.auth.refresh(body.refreshToken, this.metadata(request)); }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  me(@Req() request: { user: AuthenticatedUser }) { return this.auth.profile(request.user.id); }

  @UseGuards(JwtAuthGuard)
  @Put('me')
  @ApiBearerAuth()
  updateProfile(@Req() request: { user: AuthenticatedUser }, @Body() body: UpdateProfileDto) { return this.auth.updateProfile(request.user.id, body); }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(200)
  @ApiBearerAuth()
  async changePassword(@Req() request: { user: AuthenticatedUser }, @Body() body: ChangePasswordDto) { await this.auth.changePassword(request.user.id, body.currentPassword, body.newPassword); return { message: 'Password changed successfully' }; }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  async logout(@Req() request: { user: AuthenticatedUser }, @Body() body: Partial<RefreshDto>) { await this.auth.logout(request.user.id, body.refreshToken); return { message: 'Logged out successfully' }; }

  private metadata(request: any) { return { ipAddress: request.ip, userAgent: request.headers['user-agent'] }; }
}
