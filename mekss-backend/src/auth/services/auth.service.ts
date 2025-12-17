import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../shared/services/prisma.service';
import { SmsService } from '../../shared/services/sms.service';
import { QueueService } from '../../shared/services/queue.service';
import { UtilService } from '../../shared/services/util.service';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

// DTOs
import { CreateUserDto } from '../dto/create-user.dto';

// Types
interface JwtPayload {
  sub: string;
  phoneNumber: string;
  role: string;
  factoryId?: string;
  parkId?: string;
}

interface OtpData {
  code: string;
  expiresAt: Date;
  attempts: number;
}

@Injectable()
export class AuthService {
  private readonly otpStorage = new Map<string, OtpData>();
  private readonly refreshTokens = new Map<string, string>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private smsService: SmsService,
    private queueService: QueueService,
    private utilService: UtilService,
    private configService: ConfigService,
  ) {}

  async validateUser(phoneNumber: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber },
      include: {
        managedFactories: true,
        managedParks: true,
      },
    });

    if (user && await bcrypt.compare(password, user.password)) {
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async register(createUserDto: CreateUserDto): Promise<any> {
    const { phoneNumber, password, name, nationalId, email, role, factoryId, parkId } = createUserDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (existingUser) {
      throw new ConflictException('User with this phone number already exists');
    }

    // Validate national ID if provided
    if (nationalId && !this.utilService.isValidIranianNationalId(nationalId)) {
      throw new BadRequestException('Invalid national ID');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        phoneNumber,
        password: hashedPassword,
        name,
        nationalId,
        email,
        role,
        isApproved: role === 'SUPER_ADMIN' ? true : false,
      },
    });

    // If factory manager, assign to factory
    if (role === 'FACTORY_MANAGER' && factoryId) {
      await this.prisma.factory.update({
        where: { id: factoryId },
        data: { managerId: user.id },
      });
    }

    // If park manager, assign to park
    if (role === 'PARK_MANAGER' && parkId) {
      await this.prisma.industrialPark.update({
        where: { id: parkId },
        data: {
          managers: {
            connect: { id: user.id },
          },
        },
      });
    }

    // Send welcome SMS
    const message = `به سامانه مدیریت پارک صنعتی مکص خوش آمدید. حساب شما در حال بررسی است.`;
    await this.smsService.sendSms({
      phoneNumber,
      message,
    });

    // Add notification job
    await this.queueService.addNotificationJob({
      userId: user.id,
      title: 'ثبت‌نام موفق',
      message: 'حساب کاربری شما با موفقیت ایجاد شد و در حال بررسی می‌باشد.',
      type: 'success',
    });

    const { password: _, ...result } = user;
    return {
      message: 'User registered successfully. Please wait for approval.',
      user: result,
    };
  }

  async login(user: any): Promise<any> {
    if (!user.isApproved) {
      throw new UnauthorizedException('Account not approved yet');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const payload: JwtPayload = {
      sub: user.id,
      phoneNumber: user.phoneNumber,
      role: user.role,
      factoryId: user.managedFactories?.[0]?.id,
      parkId: user.managedParks?.[0]?.id,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.generateRefreshToken(user.id);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        role: user.role,
        factoryId: user.managedFactories?.[0]?.id,
        parkId: user.managedParks?.[0]?.id,
      },
    };
  }

  async sendOtp(phoneNumber: string): Promise<any> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Generate OTP
    const otp = this.utilService.generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP
    this.otpStorage.set(phoneNumber, {
      code: otp,
      expiresAt,
      attempts: 0,
    });

    // Send OTP via SMS
    const smsSent = await this.smsService.sendOtp(phoneNumber, otp);

    if (!smsSent) {
      throw new BadRequestException('Failed to send OTP');
    }

    return {
      message: 'OTP sent successfully',
      expiresIn: 300, // 5 minutes in seconds
    };
  }

  async verifyOtp(phoneNumber: string, otp: string): Promise<any> {
    const otpData = this.otpStorage.get(phoneNumber);

    if (!otpData) {
      throw new BadRequestException('OTP not found or expired');
    }

    if (new Date() > otpData.expiresAt) {
      this.otpStorage.delete(phoneNumber);
      throw new BadRequestException('OTP expired');
    }

    if (otp !== otpData.code) {
      otpData.attempts++;
      
      if (otpData.attempts >= 3) {
        this.otpStorage.delete(phoneNumber);
        throw new BadRequestException('Too many attempts, OTP expired');
      }

      throw new BadRequestException('Invalid OTP');
    }

    // OTP is valid, generate tokens
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber },
      include: {
        managedFactories: true,
        managedParks: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Clean up OTP
    this.otpStorage.delete(phoneNumber);

    return this.login(user);
  }

  async forgotPassword(phoneNumber: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Generate OTP for password reset
    const otp = this.utilService.generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    this.otpStorage.set(`reset-${phoneNumber}`, {
      code: otp,
      expiresAt,
      attempts: 0,
    });

    // Send OTP via SMS
    const smsSent = await this.smsService.sendOtp(phoneNumber, otp);

    if (!smsSent) {
      throw new BadRequestException('Failed to send OTP');
    }

    return {
      message: 'Password reset OTP sent successfully',
      expiresIn: 600, // 10 minutes in seconds
    };
  }

  async resetPassword(phoneNumber: string, otp: string, newPassword: string): Promise<any> {
    const otpKey = `reset-${phoneNumber}`;
    const otpData = this.otpStorage.get(otpKey);

    if (!otpData) {
      throw new BadRequestException('OTP not found or expired');
    }

    if (new Date() > otpData.expiresAt) {
      this.otpStorage.delete(otpKey);
      throw new BadRequestException('OTP expired');
    }

    if (otp !== otpData.code) {
      otpData.attempts++;
      
      if (otpData.attempts >= 3) {
        this.otpStorage.delete(otpKey);
        throw new BadRequestException('Too many attempts, OTP expired');
      }

      throw new BadRequestException('Invalid OTP');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password
    await this.prisma.user.update({
      where: { phoneNumber },
      data: { password: hashedPassword },
    });

    // Clean up OTP
    this.otpStorage.delete(otpKey);

    return {
      message: 'Password reset successfully',
    };
  }

  async refreshTokens(refreshToken: string): Promise<any> {
    try {
      const payload = this.jwtService.verify(refreshToken);
      
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          managedFactories: true,
          managedParks: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newPayload: JwtPayload = {
        sub: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        factoryId: user.managedFactories?.[0]?.id,
        parkId: user.managedParks?.[0]?.id,
      };

      const newAccessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.generateRefreshToken(user.id);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getProfile(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        managedFactories: true,
        managedParks: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const { password, ...result } = user;
    return result;
  }

  async updateProfile(userId: string, updateData: any): Promise<any> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        managedFactories: true,
        managedParks: true,
      },
    });

    const { password, ...result } = user;
    return result;
  }

  async logout(userId: string): Promise<any> {
    // Remove refresh token
    this.refreshTokens.delete(userId);
    
    return {
      message: 'Logout successful',
    };
  }

  private generateRefreshToken(userId: string): string {
    const refreshToken = this.utilService.generateToken();
    this.refreshTokens.set(userId, refreshToken);
    
    return refreshToken;
  }
}