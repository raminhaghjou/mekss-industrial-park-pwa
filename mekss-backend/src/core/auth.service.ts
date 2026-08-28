import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose, Prisma, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';
import { AuditService } from './audit.service';
import { PrismaService } from './prisma.service';
import { SmsGateway } from './sms.gateway';

export type PublicUser = Pick<
  User,
  | 'id'
  | 'phoneNumber'
  | 'username'
  | 'name'
  | 'nationalId'
  | 'email'
  | 'role'
  | 'isApproved'
  | 'isActive'
  | 'mustChangePassword'
  | 'avatar'
  | 'createdAt'
  | 'updatedAt'
  | 'lastLoginAt'
  | 'employeeOfFactoryId'
  | 'canApproveRequestTypes'
  | 'messagingRestricted'
>;

type TokenDatabase = Pick<Prisma.TransactionClient, 'refreshToken'>;

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
      data: { phoneNumber: input.phoneNumber, password, name: input.name, email: this.canonicalNullable(input.email), role: Role.EMPLOYEE, isApproved: false },
    });
    await this.audit.record({ userId: user.id, action: 'REGISTER', entity: 'User', entityId: user.id });
    return { message: 'Registration submitted for approval', user: this.publicUser(user) };
  }

  async login(phoneNumber: string, password: string, metadata: { ipAddress?: string; userAgent?: string }): Promise<ReturnType<AuthService['issueTokens']>> {
    const candidate = await this.prisma.user.findUnique({ where: { phoneNumber }, select: { id: true } });
    if (!candidate) throw new UnauthorizedException('Invalid credentials');
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, candidate.id);
      const user = await tx.user.findUnique({ where: { id: candidate.id } });
      if (!user || user.phoneNumber !== phoneNumber || !(await bcrypt.compare(password, user.password))) {
        throw new UnauthorizedException('Invalid credentials');
      }
      this.assertCanAuthenticate(user);
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      await this.audit.record({ userId: user.id, action: 'LOGIN_PASSWORD', entity: 'User', entityId: user.id, ...metadata }, tx);
      return this.issueTokens(user, metadata, tx);
    });
  }

  async sendOtp(phoneNumber: string, purpose: OtpPurpose): Promise<{ expiresIn: number }> {
    const candidate = await this.prisma.user.findUnique({ where: { phoneNumber }, select: { id: true } });
    if (!candidate) throw new NotFoundException('User not found');
    const code = randomInt(100000, 1000000).toString();
    const expiryMinutes = this.numberConfig('OTP_EXPIRY_MINUTES', 5);
    const codeHash = await bcrypt.hash(code, this.bcryptRounds());
    const userId = await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, candidate.id);
      const user = await tx.user.findUnique({ where: { id: candidate.id } });
      if (!user || user.phoneNumber !== phoneNumber) throw new NotFoundException('User not found');
      this.assertCanAuthenticate(user);
      await tx.otpChallenge.updateMany({
        where: { phoneNumber, purpose, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await tx.otpChallenge.create({
        data: { phoneNumber, userId: user.id, purpose, codeHash, expiresAt: new Date(Date.now() + expiryMinutes * 60_000) },
      });
      return user.id;
    });
    await this.sms.sendOtp(phoneNumber, code);
    await this.audit.record({ userId, action: `OTP_SENT_${purpose}`, entity: 'OtpChallenge', entityId: phoneNumber });
    return { expiresIn: expiryMinutes * 60 };
  }

  async verifyLoginOtp(phoneNumber: string, code: string, metadata: { ipAddress?: string; userAgent?: string }) {
    const consumedUser = await this.consumeOtp(phoneNumber, code, OtpPurpose.LOGIN);
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, consumedUser.id);
      const user = await tx.user.findUnique({ where: { id: consumedUser.id } });
      if (!user || user.phoneNumber !== phoneNumber) throw new UnauthorizedException('Invalid credentials');
      this.assertCanAuthenticate(user);
      await this.audit.record({ userId: user.id, action: 'LOGIN_OTP', entity: 'User', entityId: user.id, ...metadata }, tx);
      return this.issueTokens(user, metadata, tx);
    });
  }

  async resetPassword(phoneNumber: string, code: string, newPassword: string): Promise<void> {
    const consumedUser = await this.consumeOtp(phoneNumber, code, OtpPurpose.PASSWORD_RESET);
    const password = await bcrypt.hash(newPassword, this.bcryptRounds());
    await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, consumedUser.id);
      const user = await tx.user.findUnique({ where: { id: consumedUser.id } });
      if (!user || user.phoneNumber !== phoneNumber) throw new UnauthorizedException('Invalid credentials');
      this.assertCanAuthenticate(user);
      await tx.user.update({
        where: { id: user.id },
        data: { password, mustChangePassword: false, sessionVersion: { increment: 1 } },
      });
      await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.record({ userId: user.id, action: 'PASSWORD_RESET', entity: 'User', entityId: user.id }, tx);
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const password = await bcrypt.hash(newPassword, this.bcryptRounds());
    await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || !(await bcrypt.compare(currentPassword, user.password))) throw new UnauthorizedException('Current password is invalid');
      await tx.user.update({
        where: { id: userId },
        data: { password, mustChangePassword: false, sessionVersion: { increment: 1 } },
      });
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.record({ userId, action: 'PASSWORD_CHANGED', entity: 'User', entityId: userId }, tx);
    });
  }

  async refresh(rawToken: string, metadata: { ipAddress?: string; userAgent?: string }) {
    const tokenHash = this.hashToken(rawToken);
    const candidate = await this.prisma.refreshToken.findUnique({ where: { tokenHash }, select: { userId: true } });
    if (!candidate) throw new UnauthorizedException('Invalid refresh token');
    return this.prisma.$transaction(async (tx) => {
      // Lock the user before claiming the token. Management mutations lock in the
      // same order, so a replacement token cannot appear after their revoke scan.
      await this.lockUser(tx, candidate.userId);
      const stored = await tx.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
      if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) throw new UnauthorizedException('Invalid refresh token');
      this.assertCanAuthenticate(stored.user);
      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
      if (claimed.count !== 1) throw new UnauthorizedException('Invalid refresh token');
      await this.audit.record({
        userId: stored.userId,
        action: 'REFRESH_TOKEN_ROTATED',
        entity: 'RefreshToken',
        entityId: stored.id,
        ...metadata,
      }, tx);
      return this.issueTokens(stored.user, metadata, tx);
    });
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
    const data: Prisma.UserUpdateInput = {
      ...input,
      ...(input.email !== undefined ? { email: this.canonicalNullable(input.email) } : {}),
    };
    const user = await this.prisma.user.update({ where: { id: userId }, data });
    await this.audit.record({ userId, action: 'PROFILE_UPDATED', entity: 'User', entityId: userId, changes: data as Prisma.InputJsonObject });
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
      await this.prisma.otpChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null, attempts: challenge.attempts, expiresAt: { gt: new Date() } },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('OTP is invalid or expired');
    }
    this.assertCanAuthenticate(challenge.user);
    const consumed = await this.prisma.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null, attempts: challenge.attempts, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new BadRequestException('OTP is invalid or expired');
    return challenge.user;
  }

  private async lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`,
    );
    if (!locked.length) throw new UnauthorizedException('Invalid or expired access token');
  }

  private async issueTokens(user: User, metadata: { ipAddress?: string; userAgent?: string }, db: TokenDatabase = this.prisma) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      phoneNumber: user.phoneNumber,
      sessionVersion: user.sessionVersion,
    });
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshDays = this.numberConfig('JWT_REFRESH_TTL_DAYS', 7);
    await db.refreshToken.create({
      data: { tokenHash: this.hashToken(refreshToken), userId: user.id, expiresAt: new Date(Date.now() + refreshDays * 86_400_000), ipAddress: metadata.ipAddress, userAgent: metadata.userAgent },
    });
    return { accessToken, refreshToken, user: this.publicUser(user), mustChangePassword: user.mustChangePassword };
  }

  private assertCanAuthenticate(user: User): void {
    if (!user.isActive) throw new ForbiddenException('Account is disabled');
    if (!user.isApproved) throw new ForbiddenException('Account is awaiting approval');
  }

  private publicUser(user: User): PublicUser {
    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      username: user.username,
      name: user.name,
      nationalId: user.nationalId,
      email: user.email,
      role: user.role,
      isApproved: user.isApproved,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      employeeOfFactoryId: user.employeeOfFactoryId,
      canApproveRequestTypes: user.canApproveRequestTypes,
      messagingRestricted: user.messagingRestricted,
    };
  }

  private canonicalNullable(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    const normalized = value.trim().toLowerCase();
    return normalized.length ? normalized : null;
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
