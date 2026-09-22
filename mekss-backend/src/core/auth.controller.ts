import { Body, Controller, Get, HttpCode, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean, IsEmail, IsIn, IsNumber, IsObject, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, MinLength, ValidateIf,
} from 'class-validator';
import { OtpPurpose, Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { AuthenticatedUser, JwtAuthGuard } from './auth.guard';

const iranianPhone = /^09\d{9}$/;
const opaqueId = /^[A-Za-z0-9_-]{1,128}$/;
const usernamePattern = /^[a-z0-9._-]{3,64}$/;
const canonicalEmail = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value;
const normalizeIranianPhone = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const digits = value.trim().replace(/\D/g, '');
  if (digits.startsWith('0098')) return `0${digits.slice(4)}`;
  if (digits.startsWith('98')) return `0${digits.slice(2)}`;
  return digits;
};
const trimString = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const lowercaseUsername = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

class CheckPhoneDto {
  @Transform(normalizeIranianPhone) @Matches(iranianPhone) phoneNumber!: string;
}

class RegisterDto {
  @Transform(normalizeIranianPhone) @Matches(iranianPhone) phoneNumber!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsString() @MinLength(8) @Matches(/^(?=.*[A-Za-zÀ-ÿآ-ی])(?=.*\d).{8,128}$/, {
    message: 'password must be at least 8 characters and include letters and numbers',
  }) password!: string;
  @Transform(canonicalEmail) @IsOptional() @IsEmail() email?: string;
  @Transform(lowercaseUsername) @IsOptional() @Matches(usernamePattern) username?: string;
  @IsIn([Role.FACTORY_OWNER, Role.EMPLOYEE]) role!: Role;
  /** Required for FACTORY_OWNER self-registration — park manager of this park must approve. */
  @ValidateIf((body: RegisterDto) => body.role === Role.FACTORY_OWNER)
  @IsString() @Matches(opaqueId) parkId!: string;
  /** Required for EMPLOYEE self-registration under a factory. */
  @ValidateIf((body: RegisterDto) => body.role === Role.EMPLOYEE)
  @IsString() @Matches(opaqueId) factoryId!: string;

  /** Factory unit fields (docs registration form) — required for FACTORY_OWNER. */
  @ValidateIf((body: RegisterDto) => body.role === Role.FACTORY_OWNER)
  @Transform(trimString) @IsString() @Length(2, 160) factoryName!: string;
  @ValidateIf((body: RegisterDto) => body.role === Role.FACTORY_OWNER)
  @Transform(trimString) @IsString() @Matches(/^\d{10,11}$/) nationalId!: string;
  @ValidateIf((body: RegisterDto) => body.role === Role.FACTORY_OWNER)
  @Transform(trimString) @IsString() @Length(2, 120) activityType!: string;
  @ValidateIf((body: RegisterDto) => body.role === Role.FACTORY_OWNER)
  @Transform(trimString) @IsString() @Length(2, 240) address!: string;
  @ValidateIf((body: RegisterDto) => body.role === Role.FACTORY_OWNER)
  @Transform(normalizeIranianPhone) @Matches(iranianPhone) factoryPhone!: string;
  @Transform(normalizeIranianPhone) @IsOptional() @Matches(iranianPhone) phoneNumber2?: string;
  @Transform(trimString) @IsOptional() @IsString() @Length(6, 20) landline?: string;
  @Transform(trimString) @IsOptional() @IsString() @Length(6, 20) fax?: string;
  @Transform(trimString) @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @Transform(trimString) @IsOptional() @IsString() @MaxLength(120) ceoName?: string;
  @Transform(trimString) @IsOptional() @IsString() @MaxLength(1000) logo?: string;
  @IsOptional() @IsObject() socialMedia?: Record<string, string>;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @Transform(trimString) @IsOptional() @IsString() @Length(2, 80) licenseNumber?: string;
}
class LoginDto {
  /** Phone login (existing). */
  @IsOptional() @Transform(normalizeIranianPhone) @Matches(iranianPhone) phoneNumber?: string;
  /** Username login (docs). Provide either phoneNumber or username. */
  @IsOptional() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @Matches(/^[a-z0-9._-]{3,64}$/) username?: string;
  @IsString() password!: string;
}
class SendOtpDto { @Transform(normalizeIranianPhone) @Matches(iranianPhone) phoneNumber!: string; }
class VerifyOtpDto {
  @Transform(normalizeIranianPhone) @Matches(iranianPhone) phoneNumber!: string;
  @Matches(/^\d{6}$/) otp!: string;
}
class RefreshDto { @IsString() @MinLength(32) refreshToken!: string; }
/** After OTP, system generates a temporary password and SMS it — client only sends phone + otp. */
class ResetPasswordDto extends VerifyOtpDto {}
class ChangePasswordDto {
  @IsString() currentPassword!: string;
  @IsString() @MinLength(8) @Matches(/^(?=.*[A-Za-zÀ-ÿآ-ی])(?=.*\d).{8,128}$/) newPassword!: string;
}
class UpdateProfileDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @Transform(canonicalEmail) @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() avatar?: string;
  @IsOptional() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @Matches(/^[a-z0-9._-]{3,64}$/) username?: string;
  /** Park managers may restrict unsolicited factory-to-manager messages. */
  @IsOptional() @IsBoolean() messagingRestricted?: boolean;
}

@ApiTags('Authentication')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('check-phone')
  checkPhone(@Query() query: CheckPhoneDto) {
    return this.auth.checkPhoneAvailable(query.phoneNumber);
  }

  @Post('register')
  register(@Body() body: RegisterDto) { return this.auth.register(body); }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto, @Req() request: any) {
    return this.auth.login(
      { phoneNumber: body.phoneNumber, username: body.username, password: body.password },
      this.metadata(request),
    );
  }

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
  async resetPassword(@Body() body: ResetPasswordDto) {
    const result = await this.auth.resetPasswordWithGeneratedTemp(body.phoneNumber, body.otp);
    return { message: 'Temporary password sent via SMS', ...result };
  }

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
  @Put('me/default-driver')
  @ApiBearerAuth()
  saveDefaultDriver(
    @Req() request: { user: AuthenticatedUser },
    @Body() body: {
      driverName: string;
      driverNationalId: string;
      driverPhone: string;
      vehicleType: string;
      licensePlate: string;
    },
  ) {
    return this.auth.saveDefaultDriver(request.user.id, body);
  }

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
