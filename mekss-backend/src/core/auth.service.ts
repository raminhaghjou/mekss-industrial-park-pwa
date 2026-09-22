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
  | 'defaultDriver'
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

  async checkPhoneAvailable(phoneNumber: string): Promise<{ available: boolean; exists: boolean }> {
    const exists = await this.prisma.user.findUnique({ where: { phoneNumber }, select: { id: true } });
    return { available: !exists, exists: Boolean(exists) };
  }

  async register(input: {
    phoneNumber: string;
    password: string;
    name: string;
    email?: string;
    username?: string;
    role: Role;
    parkId?: string;
    factoryId?: string;
    factoryName?: string;
    nationalId?: string;
    activityType?: string;
    address?: string;
    factoryPhone?: string;
    phoneNumber2?: string;
    landline?: string;
    fax?: string;
    description?: string;
    ceoName?: string;
    logo?: string;
    socialMedia?: Record<string, string>;
    latitude?: number;
    longitude?: number;
    licenseNumber?: string;
  }): Promise<{ message: string; user: PublicUser }> {
    const exists = await this.prisma.user.findUnique({ where: { phoneNumber: input.phoneNumber } });
    if (exists) throw new ConflictException('A user with this phone number already exists');

    if (input.username) {
      const usernameTaken = await this.prisma.user.findFirst({
        where: { username: input.username },
        select: { id: true },
      });
      if (usernameTaken) throw new ConflictException('Username is already taken');
    }

    const role = input.role === Role.FACTORY_OWNER ? Role.FACTORY_OWNER : Role.EMPLOYEE;
    let requestedParkId: string | null = null;
    let employeeOfFactoryId: string | null = null;
    let parkName = '';

    if (role === Role.FACTORY_OWNER) {
      if (!input.parkId) throw new BadRequestException('parkId is required for factory owner registration');
      if (!input.factoryName || !input.nationalId || !input.activityType || !input.address || !input.factoryPhone) {
        throw new BadRequestException('factoryName, nationalId, activityType, address and factoryPhone are required');
      }
      const park = await this.prisma.industrialPark.findFirst({
        where: { id: input.parkId, status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          managers: {
            where: { isActive: true, isApproved: true, role: Role.PARK_MANAGER },
            select: { phoneNumber: true, name: true },
          },
        },
      });
      if (!park) throw new NotFoundException('Industrial park not found');
      requestedParkId = park.id;
      parkName = park.name;

      const nationalTaken = await this.prisma.factory.findFirst({
        where: { OR: [{ nationalId: input.nationalId }, { licenseNumber: input.licenseNumber || input.nationalId }] },
        select: { id: true },
      });
      if (nationalTaken) throw new ConflictException('Factory national ID or license number already registered');
    } else {
      if (!input.factoryId) throw new BadRequestException('factoryId is required for employee registration');
      const factory = await this.prisma.factory.findFirst({
        where: { id: input.factoryId, status: 'ACTIVE', isApproved: true },
        select: { id: true, parkId: true },
      });
      if (!factory) throw new NotFoundException('Factory not found');
      employeeOfFactoryId = factory.id;
      requestedParkId = factory.parkId;
    }

    const password = await bcrypt.hash(input.password, this.bcryptRounds());
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          phoneNumber: input.phoneNumber,
          password,
          name: input.name,
          email: this.canonicalNullable(input.email),
          username: input.username || null,
          role,
          isApproved: false,
          isActive: true,
          requestedParkId,
          employeeOfFactoryId,
        },
      });

      if (role === Role.FACTORY_OWNER && requestedParkId) {
        await tx.factory.create({
          data: {
            name: input.factoryName!,
            licenseNumber: input.licenseNumber || input.nationalId!,
            nationalId: input.nationalId!,
            activityType: input.activityType!,
            address: input.address!,
            phoneNumber: input.factoryPhone!,
            phoneNumber2: input.phoneNumber2 || null,
            landline: input.landline || null,
            fax: input.fax || null,
            email: this.canonicalNullable(input.email),
            description: input.description || null,
            ceoName: input.ceoName || null,
            logo: input.logo || null,
            socialMedia: input.socialMedia ? (input.socialMedia as Prisma.InputJsonValue) : undefined,
            latitude: input.latitude,
            longitude: input.longitude,
            parkId: requestedParkId,
            managerId: created.id,
            status: 'PENDING',
            isApproved: false,
          },
        });
      }

      await this.audit.record(
        { userId: created.id, action: 'REGISTER', entity: 'User', entityId: created.id, changes: { role, requestedParkId } },
        tx,
      );
      return created;
    });

    if (role === Role.FACTORY_OWNER && requestedParkId) {
      const park = await this.prisma.industrialPark.findUnique({
        where: { id: requestedParkId },
        select: {
          name: true,
          managers: {
            where: { isActive: true, isApproved: true, role: Role.PARK_MANAGER },
            select: { phoneNumber: true },
          },
        },
      });
      const factoryLabel = input.factoryName || input.name;
      const sms = `کاربر گرامی مدیر شهرک صنعتی ${park?.name || parkName} واحد صنعتی ${factoryLabel} در حساب کاربری مکص شما ثبت نام نموده است لطفا نسبت به تایید کاربری ، بررسی لازم به را عمل آورید`;
      for (const manager of park?.managers || []) {
        if (manager.phoneNumber) {
          try {
            await this.sms.sendText(manager.phoneNumber, sms);
          } catch {
            /* non-blocking */
          }
        }
      }
    }

    return { message: 'Registration submitted for approval', user: this.publicUser(user) };
  }

  async login(
    input: { phoneNumber?: string; username?: string; password: string },
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<ReturnType<AuthService['issueTokens']>> {
    const phone = input.phoneNumber?.trim();
    const username = input.username?.trim().toLowerCase();
    if (!phone && !username) throw new BadRequestException('phoneNumber or username is required');
    if (phone && username) throw new BadRequestException('Provide either phoneNumber or username, not both');

    const candidate = phone
      ? await this.prisma.user.findUnique({ where: { phoneNumber: phone }, select: { id: true } })
      : await this.prisma.user.findFirst({ where: { username: username! }, select: { id: true } });
    if (!candidate) throw new UnauthorizedException('Invalid credentials');

    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, candidate.id);
      const user = await tx.user.findUnique({ where: { id: candidate.id } });
      if (!user || !(await bcrypt.compare(input.password, user.password))) {
        throw new UnauthorizedException('Invalid credentials');
      }
      if (phone && user.phoneNumber !== phone) throw new UnauthorizedException('Invalid credentials');
      if (username && (user.username || '').toLowerCase() !== username) {
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

  /**
   * Docs flow: after OTP, system generates a temporary password, SMS username + temp password,
   * and forces mustChangePassword so the user sets their own password in-panel.
   */
  async resetPasswordWithGeneratedTemp(phoneNumber: string, code: string): Promise<{ delivered: true }> {
    const consumedUser = await this.consumeOtp(phoneNumber, code, OtpPurpose.PASSWORD_RESET);
    const tempPassword = this.generateTempPassword();
    const password = await bcrypt.hash(tempPassword, this.bcryptRounds());
    let usernameLabel = '';
    await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, consumedUser.id);
      const user = await tx.user.findUnique({ where: { id: consumedUser.id } });
      if (!user || user.phoneNumber !== phoneNumber) throw new UnauthorizedException('Invalid credentials');
      this.assertCanAuthenticate(user);
      usernameLabel = user.username || user.phoneNumber;
      await tx.user.update({
        where: { id: user.id },
        data: { password, mustChangePassword: true, sessionVersion: { increment: 1 } },
      });
      await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.record({ userId: user.id, action: 'PASSWORD_RESET_TEMP', entity: 'User', entityId: user.id }, tx);
    });
    await this.sms.sendText(
      phoneNumber,
      `MEKSS بازیابی رمز: نام کاربری شما ${usernameLabel} و رمز موقت ${tempPassword} است. پس از ورود حتماً رمز دلخواه خود را از پنل تغییر دهید.`,
    );
    return { delivered: true };
  }

  private generateTempPassword(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let out = '';
    for (let i = 0; i < 10; i += 1) out += alphabet[randomInt(0, alphabet.length)];
    // Guarantee letter+digit for validation rules elsewhere.
    return `${out}a1`;
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

  async updateProfile(userId: string, input: { name?: string; email?: string; avatar?: string; username?: string; messagingRestricted?: boolean }): Promise<PublicUser> {
    if (input.avatar) {
      const asset = await this.prisma.mediaAsset.findFirst({
        where: { id: input.avatar, uploadedById: userId, domain: 'avatar' },
        select: { id: true },
      });
      if (!asset) throw new BadRequestException('آواتار معتبر نیست؛ ابتدا فایل را آپلود کنید');
    }
    if (input.username) {
      const taken = await this.prisma.user.findFirst({
        where: { username: input.username, id: { not: userId } },
        select: { id: true },
      });
      if (taken) throw new ConflictException('این نام کاربری قبلاً استفاده شده است');
    }
    const existing = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!existing) throw new NotFoundException('User not found');
    if (input.messagingRestricted !== undefined && existing.role !== Role.PARK_MANAGER) {
      throw new BadRequestException('Only park managers can change messaging restriction');
    }
    const data: Prisma.UserUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: this.canonicalNullable(input.email) } : {}),
      ...(input.avatar !== undefined ? { avatar: input.avatar } : {}),
      ...(input.username !== undefined ? { username: input.username } : {}),
      ...(input.messagingRestricted !== undefined ? { messagingRestricted: input.messagingRestricted } : {}),
    };
    const user = await this.prisma.user.update({ where: { id: userId }, data });
    await this.audit.record({ userId, action: 'PROFILE_UPDATED', entity: 'User', entityId: userId, changes: data as Prisma.InputJsonObject });
    return this.publicUser(user);
  }

  async saveDefaultDriver(userId: string, driver: {
    driverName: string;
    driverNationalId: string;
    driverPhone: string;
    vehicleType: string;
    licensePlate: string;
  }): Promise<PublicUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        defaultDriver: {
          driverName: driver.driverName,
          driverNationalId: driver.driverNationalId,
          driverPhone: driver.driverPhone,
          vehicleType: driver.vehicleType,
          licensePlate: driver.licensePlate,
        },
      },
    });
    await this.audit.record({ userId, action: 'DEFAULT_DRIVER_SAVED', entity: 'User', entityId: userId });
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
    if (!user.isApproved) throw new ForbiddenException('کاربری شما تایید نگردیده است');
  }

  private publicUser(user: User): PublicUser & { avatarUrl?: string | null } {
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
      avatarUrl: user.avatar ? `/api/v1/files/${user.avatar}/content` : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      employeeOfFactoryId: user.employeeOfFactoryId,
      canApproveRequestTypes: user.canApproveRequestTypes,
      messagingRestricted: user.messagingRestricted,
      defaultDriver: user.defaultDriver,
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
