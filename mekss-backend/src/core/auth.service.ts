import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt, createHash } from 'crypto';
import { AuditService } from './audit.service';
import { PrismaService } from './prisma.service';
import { SmsGateway } from './sms.gateway';

export type PublicUser = Omit<User, 'password'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sms: SmsGateway,
    private readonly audit: AuditService,
  ) {}

  async register(input: { phoneNumber: string; password: string; name: string; email?: string }): Promise<{ message: string; user: PublicUser }> {
    const exists = await this.prisma.user.findUnique({ where: { phoneNumber: input.phoneNumber } });
    if (exists) throw new ConflictException('A user with this phone number already exists');
    const password = await bcrypt.hash(input.password, this.bcryptRounds());
    const user = await this.prisma.user.create({
      data: { phoneNumber: input.phoneNumber, password, name: input.name, email: input.email, role: Role.EMPLOYEE, isApproved: false },
    });
    await this.audit.record({ userId: user.id, action: 'REGISTER', entity: 'User', entityId: user.id });
    return { message: 'Registration submitted for approval', user: this.publicUser(user) };
  }

  async login(phoneNumber: string, password: string, metadata: { ipAddress?: string; userAgent?: string }): Promise<ReturnType<AuthService['issueTokens']>> {
    const user = await this.prisma.user.findUnique({ where: { phoneNumber } });
    if (!user || !(await bcrypt.compare(password, user.password))) throw new UnauthorizedException('Invalid credentials');
    this.assertCanAuthenticate(user);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.record({ userId: user.id, action: 'LOGIN_PASSWORD', entity: 'User', entityId: user.id, ...metadata });
    return this.issueTokens(user, metadata);
  }

  async sendOtp(phoneNumber: string, purpose: OtpPurpose): Promise<{ expiresIn: number }> {
    const user = await this.prisma.user.findUnique({ where: { phoneNumber } });
    if (!user) throw new NotFoundException('User not found');
    this.assertCanAuthenticate(user);
    const code = randomInt(100000, 1000000).toString();
    const expiryMinutes = this.numberConfig('OTP_EXPIRY_MINUTES', 5);
    await this.prisma.$transaction([
      this.prisma.otpChallenge.updateMany({
        where: { phoneNumber, purpose, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.otpChallenge.create({
        data: { phoneNumber, userId: user.id, purpose, codeHash: await bcrypt.hash(code, this.bcryptRounds()), expiresAt: new Date(Date.now() + expiryMinutes * 60_000) },
      }),
    ]);
    await this.sms.sendOtp(phoneNumber, code);
    await this.audit.record({ userId: user.id, action: `OTP_SENT_${purpose}`, entity: 'OtpChallenge', entityId: phoneNumber });
    return { expiresIn: expiryMinutes * 60 };
  }

  async verifyLoginOtp(phoneNumber: string, code: string, metadata: { ipAddress?: string; userAgent?: string }) {
    const user = await this.consumeOtp(phoneNumber, code, OtpPurpose.LOGIN);
    await this.audit.record({ userId: user.id, action: 'LOGIN_OTP', entity: 'User', entityId: user.id, ...metadata });
    return this.issueTokens(user, metadata);
  }

  async resetPassword(phoneNumber: string, code: string, newPassword: string): Promise<void> {
    const user = await this.consumeOtp(phoneNumber, code, OtpPurpose.PASSWORD_RESET);
    await this.prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(newPassword, this.bcryptRounds()), mustChangePassword: false } });
    await this.prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.record({ userId: user.id, action: 'PASSWORD_RESET', entity: 'User', entityId: user.id });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) throw new UnauthorizedException('Current password is invalid');
    await this.prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(newPassword, this.bcryptRounds()), mustChangePassword: false } });
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.record({ userId, action: 'PASSWORD_CHANGED', entity: 'User', entityId: userId });
  }

  async refresh(rawToken: string, metadata: { ipAddress?: string; userAgent?: string }) {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) throw new UnauthorizedException('Invalid refresh token');
    this.assertCanAuthenticate(stored.user);
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    await this.audit.record({ userId: stored.userId, action: 'REFRESH_TOKEN_ROTATED', entity: 'RefreshToken', entityId: stored.id, ...metadata });
    return this.issueTokens(stored.user, metadata);
  }

  async logout(userId: string, rawToken?: string): Promise<void> {
    if (rawToken) {
      await this.prisma.refreshToken.updateMany({ where: { userId, tokenHash: this.hashToken(rawToken), revokedAt: null }, data: { revokedAt: new Date() } });
    } else {
      await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.record({ userId, action: 'LOGOUT', entity: 'User', entityId: userId });
  }

  async profile(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.publicUser(user);
  }

  async updateProfile(userId: string, input: { name?: string; email?: string; avatar?: string }): Promise<PublicUser> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: input });
    await this.audit.record({ userId, action: 'PROFILE_UPDATED', entity: 'User', entityId: userId, changes: input });
    return this.publicUser(user);
  }

  private async consumeOtp(phoneNumber: string, code: string, purpose: OtpPurpose): Promise<User> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phoneNumber, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
    if (!challenge || !challenge.user) throw new BadRequestException('OTP is invalid or expired');
    const maxAttempts = this.numberConfig('OTP_MAX_ATTEMPTS', 3);
    if (challenge.attempts >= maxAttempts) throw new BadRequestException('OTP attempt limit reached');
    if (!(await bcrypt.compare(code, challenge.codeHash))) {
      await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException('OTP is invalid or expired');
    }
    this.assertCanAuthenticate(challenge.user);
    await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
    return challenge.user;
  }

  private async issueTokens(user: User, metadata: { ipAddress?: string; userAgent?: string }) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role, phoneNumber: user.phoneNumber });
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshDays = this.numberConfig('JWT_REFRESH_TTL_DAYS', 7);
    await this.prisma.refreshToken.create({
      data: { tokenHash: this.hashToken(refreshToken), userId: user.id, expiresAt: new Date(Date.now() + refreshDays * 86_400_000), ipAddress: metadata.ipAddress, userAgent: metadata.userAgent },
    });
    return { accessToken, refreshToken, user: this.publicUser(user), mustChangePassword: user.mustChangePassword };
  }

  private assertCanAuthenticate(user: User): void {
    if (!user.isActive) throw new ForbiddenException('Account is disabled');
    if (!user.isApproved) throw new ForbiddenException('Account is awaiting approval');
  }

  private publicUser(user: User): PublicUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...publicUser } = user;
    return publicUser;
  }

  private hashToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private bcryptRounds(): number {
    return this.numberConfig('BCRYPT_ROUNDS', 12);
  }

  private numberConfig(name: string, fallback: number): number {
    const value = Number(this.config.get<string>(name));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
