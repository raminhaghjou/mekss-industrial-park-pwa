import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdvertisementStatus, CargoType, EmergencyStatus, FactoryStatus, GatePassStatus, InvoiceAdjustmentType, InvoiceCategory, InvoiceItemType, InvoiceStatus, InvoiceTarget, MarketRateKey, MessageStatus, ParkStatus, PaymentStatus, PlateType, Prisma, RequestStatus, RequestType, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from './audit.service';
import { AuthenticatedUser } from './auth.guard';
import { AdvertisementAdminQueryDto, CreateAdvertisementCategoryDto, CreateAdvertisementDto, CreateBannerDto, CreateFeedbackDto, PublicAdvertisementQueryDto, UpdateAdvertisementCategoryDto, UpdateAdvertisementDto, CreateAnnouncementDto, CreateEmergencyDto, CreateFactoryDto, CreateFactoryStaffDto, CreateManagedUserDto, CreateParkDto, CreateParkStaffDto, FactoryAdminQueryDto, InvoiceDiscountDto, InvoiceExtendDueDto, InvoiceInstallmentsDto, InvoiceItemDto, InvoiceSettleDto, PublicSmsRequestDto, RegisterFactoryDto, SendDirectMessageDto, UpdateAnnouncementDto, UpdateBannerDto, UpdateFactoryDto, UpdateFactoryStaffDto, UpdateManagedUserDto, UpdateMarketRateDto, UpdateParkDto, UpdateParkStaffDto } from './management.dto';
import {
  addDays,
  calendarDaysLate,
  categoryForRole,
  defaultInvoiceDescription,
  formatJalaliDate,
  formatJalaliDateTime,
  formatRial,
  INVOICE_ITEM_LABELS_FA,
  itemsSummaryFa,
  MAX_INVOICE_AMOUNT,
  normalizeInvoiceItems,
  NormalizedInvoiceItem,
  splitEvenly,
  sumItems,
} from './invoice-billing';
import { buildImportTemplate, ImportTarget, parseImportWorkbook } from './invoice-import';
import { PrismaService } from './prisma.service';
import { currentCorrelationId } from './request-context';
import { SmsGateway } from './sms.gateway';
import { GatePassEvents } from './gate-pass-events';
import { buildSemanticContainsOr } from '../shared/utils/semantic-search.util';
import { canonicalPlateOrRaw, normalizePlate } from '../anpr/plate-grammar';

type AuditPlan<T> = {
  action: string;
  entity: string;
  entityId: string | ((result: T) => string);
  changes?: Prisma.InputJsonValue;
};

type UserMutationAudit = { action: string; changes?: Prisma.InputJsonValue };
type UserMutationOutcome<T> = { result: T; audit?: UserMutationAudit };

const USER_RELATION_COUNT_SELECT = {
  managedFactories: true,
  managedParks: true,
  gatePassesCreated: true,
  gatePassesApproved: true,
  gatePassesVerified: true,
  invoicesCreated: true,
  invoicesPaid: true,
  messagesSent: true,
  messagesReceived: true,
  requestsCreated: true,
  requestsApproved: true,
  announcements: true,
  advertisements: true,
  moderatedAdvertisements: true,
  favoriteAdvertisements: true,
  securityShifts: true,
  notifications: true,
  emergencies: true,
  paymentAttempts: true,
  uploadedFiles: true,
  feedbackSent: true,
  marketRateUpdates: true,
} as const;

const USER_LIST_SELECT = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  phoneNumber: true,
  username: true,
  name: true,
  nationalId: true,
  email: true,
  role: true,
  isApproved: true,
  isActive: true,
  mustChangePassword: true,
  avatar: true,
  employeeOfFactoryId: true,
  canApproveRequestTypes: true,
  messagingRestricted: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  _count: { select: USER_RELATION_COUNT_SELECT },
});

const USER_DETAIL_SELECT = Prisma.validator<Prisma.UserSelect>()({
  ...USER_LIST_SELECT,
  employeeOfFactory: { select: { id: true, name: true, parkId: true } },
  managedFactories: { select: { id: true, name: true, parkId: true, status: true, isApproved: true }, orderBy: { id: 'asc' } },
  managedParks: { select: { id: true, code: true, name: true, status: true }, orderBy: { id: 'asc' } },
});

type UserListRecord = Prisma.UserGetPayload<{ select: typeof USER_LIST_SELECT }>;
type UserDetailRecord = Prisma.UserGetPayload<{ select: typeof USER_DETAIL_SELECT }>;

const ADVERTISEMENT_MODERATION_SELECT = Prisma.validator<Prisma.AdvertisementSelect>()({
  id: true,
  title: true,
  province: true,
  city: true,
  address: true,
  content: true,
  price: true,
  contactInfo: true,
  images: true,
  status: true,
  isApproved: true,
  rejectionReason: true,
  isFeatured: true,
  featuredUntil: true,
  createdAt: true,
  updatedAt: true,
  expiresAt: true,
  moderatedAt: true,
  category: { select: { id: true, key: true, label: true } },
  createdBy: { select: { id: true, name: true, phoneNumber: true } },
  park: { select: { id: true, code: true, name: true } },
  moderatedBy: { select: { id: true, name: true } },
});

type AdvertisementModerationRecord = Prisma.AdvertisementGetPayload<{ select: typeof ADVERTISEMENT_MODERATION_SELECT }>;
type AdvertisementParkSummary = { id: string; code: string; name: string };
type AdvertisementScopeDatabase = Pick<Prisma.TransactionClient, 'industrialPark'>;

const FACTORY_MANAGEMENT_SELECT = Prisma.validator<Prisma.FactorySelect>()({
  id: true,
  name: true,
  licenseNumber: true,
  licenseExpiry: true,
  nationalId: true,
  activityType: true,
  address: true,
  phoneNumber: true,
  phoneNumber2: true,
  landline: true,
  fax: true,
  email: true,
  website: true,
  description: true,
  establishedDate: true,
  employees: true,
  status: true,
  suspendedReason: true,
  suspendedAt: true,
  isApproved: true,
  rejectionReason: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  logo: true,
  ceoName: true,
  socialMedia: true,
  shopUrl: true,
  latitude: true,
  longitude: true,
  pendingChanges: true,
  managerId: true,
  parkId: true,
  park: { select: { id: true, code: true, name: true, province: true, city: true, status: true } },
  manager: { select: { id: true, name: true, phoneNumber: true, email: true } },
  reviewedBy: { select: { id: true, name: true } },
});

type FactoryManagementRecord = Prisma.FactoryGetPayload<{ select: typeof FACTORY_MANAGEMENT_SELECT }>;
type FactoryScopeDatabase = Pick<Prisma.TransactionClient, 'factory' | 'industrialPark' | 'user'>;

const MARKET_RATE_DEFAULTS: Record<MarketRateKey, { label: string; value: number; unit: string }> = {
  USD: { label: 'دلار آمریکا', value: 0, unit: 'ریال' },
  EUR: { label: 'یورو', value: 0, unit: 'ریال' },
  CNY: { label: 'یوان چین', value: 0, unit: 'ریال' },
  IRON: { label: 'شمش آهن', value: 0, unit: 'ریال/کیلو' },
  GOLD: { label: 'طلای ۱۸ عیار', value: 0, unit: 'ریال/گرم' },
  SILVER: { label: 'نقره', value: 0, unit: 'ریال/گرم' },
  PLATINUM: { label: 'پلاتین', value: 0, unit: 'ریال/گرم' },
  COIN: { label: 'سکه امامی', value: 0, unit: 'ریال' },
  COPPER: { label: 'مس', value: 0, unit: 'ریال/کیلو' },
  ALUMINUM: { label: 'آلومینیوم', value: 0, unit: 'ریال/کیلو' },
  OIL: { label: 'نفت برنت', value: 0, unit: 'دلار/بشکه' },
  BITUMEN: { label: 'قیر', value: 0, unit: 'ریال/کیلو' },
  USDT: { label: 'تتر (USDT)', value: 0, unit: 'ریال' },
  BTC: { label: 'بیت‌کوین', value: 0, unit: 'ریال' },
  ETH: { label: 'اتریوم', value: 0, unit: 'ریال' },
};

const SMS_REQUEST_CODE_MAP: Record<string, RequestType> = {
  '1': RequestType.SERVICE_ORDER,
  '2': RequestType.APPOINTMENT,
  '3': RequestType.OTHER,
  '4': RequestType.MISSION,
  '5': RequestType.TRANSFER,
  '6': RequestType.DAILY_LEAVE,
  '7': RequestType.HOURLY_LEAVE,
  '8': RequestType.LOAN,
  '9': RequestType.SETTLEMENT,
};

/** Public SMS channel codes for gate-pass workflows (91=issue intent, 92=status query). */
const SMS_GATE_PASS_CODES = new Set(['91', '92']);

const REQUEST_TYPE_FA: Record<RequestType, string> = {
  [RequestType.MISSION]: 'ماموریت',
  [RequestType.TRANSFER]: 'انتقال',
  [RequestType.DAILY_LEAVE]: 'مرخصی روزانه',
  [RequestType.HOURLY_LEAVE]: 'مرخصی ساعتی',
  [RequestType.LOAN]: 'مساعده',
  [RequestType.SETTLEMENT]: 'تسویه حساب',
  [RequestType.CONSTRUCTION_PERMIT]: 'مجوز ساخت',
  [RequestType.FINAL_INSPECTION]: 'بازرسی پایان کار',
  [RequestType.APPOINTMENT]: 'نوبت کارشناسی',
  [RequestType.SERVICE_ORDER]: 'سفارش خدمات',
  [RequestType.OTHER]: 'اداری',
};

const STAFF_USER_SELECT = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  phoneNumber: true,
  name: true,
  role: true,
  isActive: true,
  isApproved: true,
  employeeOfFactoryId: true,
  canApproveRequestTypes: true,
  createdAt: true,
  updatedAt: true,
});

const PARK_STAFF_USER_SELECT = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  phoneNumber: true,
  username: true,
  name: true,
  nationalId: true,
  email: true,
  role: true,
  isActive: true,
  isApproved: true,
  mustChangePassword: true,
  employeeOfParkId: true,
  createdAt: true,
  updatedAt: true,
});

@Injectable()
export class ManagementService {
  private readonly logger = new Logger(ManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly sms: SmsGateway = { sendOtp: async () => undefined, sendText: async () => undefined } as unknown as SmsGateway,
    private readonly gatePassEvents: GatePassEvents = new GatePassEvents(),
  ) {}

  async users(query?: { page?: number; pageSize?: number; search?: string }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query?.pageSize) || 20));
    const where: Prisma.UserWhereInput =
      buildSemanticContainsOr<Prisma.UserWhereInput>(
        ['name', 'phoneNumber', 'email', 'username', 'nationalId'],
        query?.search,
      ) || {};
    return this.prisma.$transaction(async (tx) => {
      const [records, total] = await Promise.all([
        tx.user.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: USER_LIST_SELECT,
        }),
        tx.user.count({ where }),
      ]);
      return { items: records.map((record) => this.safeUserSummary(record)), total, page, pageSize };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async userDetail(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_DETAIL_SELECT });
    if (!user) throw new NotFoundException('User not found');
    return this.safeUserDetail(user);
  }

  async createUser(actor: AuthenticatedUser, input: CreateManagedUserDto) {
    const password = await bcrypt.hash(input.password, 12);
    const created = await this.userLifecycleTransaction(actor, undefined, async (tx) => {
      const managedParkIds = this.uniqueIds(input.managedParkIds ?? [], 'managedParkIds');
      const managedFactoryIds = this.uniqueIds(input.managedFactoryIds ?? [], 'managedFactoryIds');
      this.assertCreateAssignmentCompatibility(input.role, managedParkIds, managedFactoryIds, input.employeeOfFactoryId ?? null);
      await this.assertAssignmentTargets(tx, managedParkIds, managedFactoryIds, input.employeeOfFactoryId ?? null);

      const created = await tx.user.create({
        data: {
          phoneNumber: input.phoneNumber,
          username: input.username ?? null,
          password,
          name: input.name,
          nationalId: input.nationalId ?? null,
          email: input.email ?? null,
          role: input.role,
          isApproved: input.isApproved ?? false,
          mustChangePassword: true,
          ...(managedParkIds.length ? { managedParks: { connect: managedParkIds.map((id) => ({ id })) } } : {}),
          ...(managedFactoryIds.length ? { managedFactories: { connect: managedFactoryIds.map((id) => ({ id })) } } : {}),
          ...(input.employeeOfFactoryId ? { employeeOfFactory: { connect: { id: input.employeeOfFactoryId } } } : {}),
        },
        select: USER_DETAIL_SELECT,
      });
      return {
        result: this.safeUserDetail(created),
        audit: {
          action: 'USER_CREATED',
          changes: {
            role: input.role,
            isApproved: input.isApproved ?? false,
            managedParkIds,
            managedFactoryIds,
            employeeOfFactoryId: input.employeeOfFactoryId ?? null,
          },
        },
      };
    });
    let employer: { name: string } | null = null;
    if (input.employeeOfFactoryId) {
      try {
        employer = await this.prisma.factory.findUnique({ where: { id: input.employeeOfFactoryId }, select: { name: true } });
      } catch {
        employer = null;
      }
    }
    await this.sendStaffCredentialsSms(
      { phoneNumber: input.phoneNumber, username: input.username },
      employer?.name ? `واحد صنعتی «${employer.name}»` : null,
    );
    return created;
  }

  async updateUser(actor: AuthenticatedUser, id: string, input: UpdateManagedUserDto) {
    if (!Object.keys(input).length) throw new BadRequestException('At least one user field must be provided');
    return this.userLifecycleTransaction(actor, id, async (tx) => {
      const existing = await tx.user.findUnique({
        where: { id },
        include: { managedParks: { select: { id: true } }, managedFactories: { select: { id: true } } },
      });
      if (!existing) throw new NotFoundException('User not found');

      const finalRole = input.role ?? existing.role;
      const finalIsApproved = input.isApproved ?? existing.isApproved;
      const finalIsActive = input.isActive ?? existing.isActive;
      if (actor.id === id && (finalRole !== Role.SUPER_ADMIN || !finalIsApproved || !finalIsActive)) {
        throw new ForbiddenException('You cannot remove your own administrative access');
      }
      if (this.isActiveApprovedSuperAdmin(existing) && !(finalRole === Role.SUPER_ADMIN && finalIsApproved && finalIsActive)) {
        await this.assertAnotherActiveSuperAdmin(tx, id);
      }

      const currentParkIds = existing.managedParks.map(({ id: parkId }) => parkId).sort();
      const currentFactoryIds = existing.managedFactories.map(({ id: factoryId }) => factoryId).sort();
      const desiredParkIds = input.managedParkIds === undefined ? currentParkIds : this.uniqueIds(input.managedParkIds, 'managedParkIds');
      const requestedFactoryIds = input.managedFactoryIds === undefined ? currentFactoryIds : this.uniqueIds(input.managedFactoryIds, 'managedFactoryIds');
      const desiredEmployeeFactoryId = input.employeeOfFactoryId === undefined ? existing.employeeOfFactoryId : input.employeeOfFactoryId;

      if (finalRole !== Role.PARK_MANAGER && desiredParkIds.length) {
        throw new ConflictException('Park assignments must be cleared before changing to this role');
      }
      if (finalRole !== Role.FACTORY_OWNER && (currentFactoryIds.length || requestedFactoryIds.length)) {
        throw new ConflictException('Factory ownership must be reassigned before changing to this role');
      }
      if (finalRole !== Role.EMPLOYEE && desiredEmployeeFactoryId) {
        throw new ConflictException('Employee factory assignment must be cleared before changing to this role');
      }
      if (finalRole === Role.PARK_MANAGER && (requestedFactoryIds.length || desiredEmployeeFactoryId)) {
        throw new ConflictException('Assignments are incompatible with the PARK_MANAGER role');
      }
      if (finalRole === Role.FACTORY_OWNER && (desiredParkIds.length || desiredEmployeeFactoryId)) {
        throw new ConflictException('Assignments are incompatible with the FACTORY_OWNER role');
      }
      if (finalRole === Role.EMPLOYEE && (desiredParkIds.length || requestedFactoryIds.length)) {
        throw new ConflictException('Assignments are incompatible with the EMPLOYEE role');
      }
      if (finalRole !== Role.PARK_MANAGER && finalRole !== Role.FACTORY_OWNER && finalRole !== Role.EMPLOYEE
        && (desiredParkIds.length || requestedFactoryIds.length || desiredEmployeeFactoryId)) {
        throw new ConflictException('Assignments are incompatible with this role');
      }

      const removedFactoryIds = currentFactoryIds.filter((factoryId) => !requestedFactoryIds.includes(factoryId));
      if (removedFactoryIds.length) {
        throw new ConflictException('Required factory ownership must be reassigned through another owner before removal');
      }
      await this.assertAssignmentTargets(
        tx,
        input.managedParkIds === undefined ? [] : desiredParkIds,
        input.managedFactoryIds === undefined ? [] : requestedFactoryIds,
        input.employeeOfFactoryId === undefined ? null : desiredEmployeeFactoryId,
      );

      const data: Prisma.UserUpdateInput = {};
      const changes: Record<string, Prisma.InputJsonValue> = {};
      const setScalar = <K extends 'phoneNumber' | 'name' | 'email' | 'username' | 'nationalId' | 'role' | 'isApproved' | 'isActive'>(key: K, value: Prisma.UserUpdateInput[K], current: unknown) => {
        if (value !== undefined && value !== current) {
          data[key] = value;
          changes[key] = value === null ? null : value as Prisma.InputJsonValue;
        }
      };
      setScalar('phoneNumber', input.phoneNumber, existing.phoneNumber);
      setScalar('name', input.name, existing.name);
      setScalar('email', input.email, existing.email);
      setScalar('username', input.username, existing.username);
      setScalar('nationalId', input.nationalId, existing.nationalId);
      setScalar('role', input.role, existing.role);
      setScalar('isApproved', input.isApproved, existing.isApproved);
      setScalar('isActive', input.isActive, existing.isActive);

      const parkAssignmentsChanged = input.managedParkIds !== undefined && !this.sameIds(currentParkIds, desiredParkIds);
      const addedFactoryIds = input.managedFactoryIds === undefined ? [] : requestedFactoryIds.filter((factoryId) => !currentFactoryIds.includes(factoryId));
      const employeeAssignmentChanged = input.employeeOfFactoryId !== undefined && desiredEmployeeFactoryId !== existing.employeeOfFactoryId;
      if (parkAssignmentsChanged) {
        data.managedParks = { set: desiredParkIds.map((parkId) => ({ id: parkId })) };
        changes.managedParkIds = desiredParkIds;
      }
      if (addedFactoryIds.length) {
        data.managedFactories = { connect: addedFactoryIds.map((factoryId) => ({ id: factoryId })) };
        changes.managedFactoryIds = requestedFactoryIds;
      }
      if (employeeAssignmentChanged) {
        data.employeeOfFactory = desiredEmployeeFactoryId ? { connect: { id: desiredEmployeeFactoryId } } : { disconnect: true };
        changes.employeeOfFactoryId = desiredEmployeeFactoryId;
      }

      const phoneChanged = input.phoneNumber !== undefined && input.phoneNumber !== existing.phoneNumber;
      const accessChanged = phoneChanged
        || input.role !== undefined && input.role !== existing.role
        || input.isApproved !== undefined && input.isApproved !== existing.isApproved
        || input.isActive !== undefined && input.isActive !== existing.isActive
        || parkAssignmentsChanged
        || addedFactoryIds.length > 0
        || employeeAssignmentChanged;
      if (!Object.keys(changes).length) {
        const unchanged = await tx.user.findUnique({ where: { id }, select: USER_DETAIL_SELECT });
        if (!unchanged) throw new NotFoundException('User not found');
        return { result: this.safeUserDetail(unchanged) };
      }
      if (accessChanged) data.sessionVersion = { increment: 1 };
      await tx.user.update({ where: { id }, data });
      const revokedAt = new Date();
      if (accessChanged) {
        await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt } });
      }
      if (phoneChanged) {
        await tx.otpChallenge.updateMany({ where: { userId: id, consumedAt: null }, data: { consumedAt: revokedAt } });
      }
      const updated = await tx.user.findUnique({ where: { id }, select: USER_DETAIL_SELECT });
      if (!updated) throw new NotFoundException('User not found');
      return { result: this.safeUserDetail(updated), audit: { action: 'USER_UPDATED', changes: changes as Prisma.InputJsonObject } };
    });
  }

  async deleteUser(actor: AuthenticatedUser, id: string) {
    if (actor.id === id) throw new ForbiddenException('You cannot delete your own account');
    try {
      return await this.userLifecycleTransaction(actor, id, async (tx) => {
        const target = await tx.user.findUnique({ where: { id } });
        if (!target) throw new NotFoundException('User not found');
        if (this.isActiveApprovedSuperAdmin(target)) await this.assertAnotherActiveSuperAdmin(tx, id);
        const blockers = await this.userDeleteBlockers(tx, id);
        if (blockers.length) throw new ConflictException('User has protected business relations and cannot be deleted');
        await tx.user.delete({ where: { id } });
        return { result: { id, deleted: true }, audit: { action: 'USER_DELETED' } };
      });
    } catch (error) {
      if (this.prismaErrorCode(error) === 'P2003') throw new ConflictException('User has protected business relations and cannot be deleted');
      throw error;
    }
  }

  async setUserActive(actor: AuthenticatedUser, id: string, isActive: boolean) {
    if (actor.id === id && !isActive) throw new ForbiddenException('You cannot deactivate your own account');
    return this.userLifecycleTransaction(actor, id, async (tx) => {
      const target = await tx.user.findUnique({ where: { id } });
      if (!target) throw new NotFoundException('User not found');
      if (target.isActive === isActive) {
        const unchanged = await tx.user.findUnique({ where: { id }, select: USER_DETAIL_SELECT });
        if (!unchanged) throw new NotFoundException('User not found');
        return { result: this.safeUserDetail(unchanged) };
      }
      if (!isActive && this.isActiveApprovedSuperAdmin(target)) await this.assertAnotherActiveSuperAdmin(tx, id);
      await tx.user.update({ where: { id }, data: { isActive, sessionVersion: { increment: 1 } } });
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      const updated = await tx.user.findUnique({ where: { id }, select: USER_DETAIL_SELECT });
      if (!updated) throw new NotFoundException('User not found');
      return { result: this.safeUserDetail(updated), audit: { action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED' } };
    });
  }

  async resetUserPassword(actor: AuthenticatedUser, id: string, newPassword: string) {
    const password = await bcrypt.hash(newPassword, 12);
    return this.userLifecycleTransaction(actor, id, async (tx) => {
      await tx.user.update({
        where: { id },
        data: { password, mustChangePassword: true, sessionVersion: { increment: 1 } },
      });
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      const updated = await tx.user.findUnique({ where: { id }, select: USER_DETAIL_SELECT });
      if (!updated) throw new NotFoundException('User not found');
      return { result: this.safeUserDetail(updated), audit: { action: 'USER_PASSWORD_RESET' } };
    });
  }

  async parks(query?: { page?: number; pageSize?: number; search?: string }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query?.pageSize) || 20));
    const search = query?.search?.trim();
    const where: Prisma.IndustrialParkWhereInput =
      buildSemanticContainsOr<Prisma.IndustrialParkWhereInput>(
        ['name', 'code', 'city', 'province', 'address'],
        search,
      ) || {};
    return this.prisma.$transaction(async (tx) => {
      const [items, total] = await Promise.all([
        tx.industrialPark.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: this.parkInclude(),
        }),
        tx.industrialPark.count({ where }),
      ]);
      return { items, total, page, pageSize };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async parkDetail(id: string) {
    const park = await this.prisma.industrialPark.findUnique({ where: { id }, include: this.parkInclude() });
    if (!park) throw new NotFoundException('Park not found');
    return park;
  }

  async createPark(actor: AuthenticatedUser, input: CreateParkDto) {
    const code = this.normalizedRequiredText(input.code, 'code');
    const managerIds = input.managerIds ?? [];
    return this.auditedTransaction(actor, {
      action: 'PARK_CREATED',
      entity: 'IndustrialPark',
      entityId: (park: { id: string }) => park.id,
      changes: { code, status: input.status ?? ParkStatus.ACTIVE, managerIds },
    }, async (tx) => {
      const existing = await tx.industrialPark.findUnique({ where: { code } });
      if (existing) throw new ConflictException('A park with this code already exists');
      await this.assertManagersValid(managerIds, tx);
      const created = await tx.industrialPark.create({
        data: {
          code,
          name: this.normalizedRequiredText(input.name, 'name'),
          province: this.normalizedRequiredText(input.province, 'province'),
          city: this.normalizedRequiredText(input.city, 'city'),
          address: this.normalizedRequiredText(input.address, 'address'),
          phoneNumber: this.normalizedRequiredText(input.phoneNumber, 'phoneNumber'),
          email: input.email === undefined ? undefined : this.normalizedNullableText(input.email),
          guardPhone: this.normalizedRequiredText(input.guardPhone, 'guardPhone'),
          totalArea: input.totalArea,
          establishedDate: input.establishedDate ? new Date(input.establishedDate) : input.establishedDate,
          description: input.description === undefined ? undefined : this.normalizedNullableText(input.description),
          status: input.status ?? ParkStatus.ACTIVE,
          managers: managerIds.length ? { connect: managerIds.map((id) => ({ id })) } : undefined,
        },
        select: { id: true },
      });
      return tx.industrialPark.findUniqueOrThrow({ where: { id: created.id }, include: this.parkInclude() });
    });
  }

  async updatePark(actor: AuthenticatedUser, id: string, input: UpdateParkDto) {
    const data: Prisma.IndustrialParkUpdateInput = {};
    if (input.code !== undefined) data.code = this.normalizedRequiredText(input.code, 'code');
    if (input.name !== undefined) data.name = this.normalizedRequiredText(input.name, 'name');
    if (input.province !== undefined) data.province = this.normalizedRequiredText(input.province, 'province');
    if (input.city !== undefined) data.city = this.normalizedRequiredText(input.city, 'city');
    if (input.address !== undefined) data.address = this.normalizedRequiredText(input.address, 'address');
    if (input.phoneNumber !== undefined) data.phoneNumber = this.normalizedRequiredText(input.phoneNumber, 'phoneNumber');
    if (input.email !== undefined) data.email = this.normalizedNullableText(input.email);
    if (input.guardPhone !== undefined) data.guardPhone = this.normalizedRequiredText(input.guardPhone, 'guardPhone');
    if (input.totalArea !== undefined) data.totalArea = input.totalArea;
    if (input.establishedDate !== undefined) data.establishedDate = input.establishedDate ? new Date(input.establishedDate) : null;
    if (input.description !== undefined) data.description = this.normalizedNullableText(input.description);
    if (input.status !== undefined) data.status = input.status;
    if (input.managerIds !== undefined) data.managers = { set: input.managerIds.map((managerId) => ({ id: managerId })) };
    if (!Object.keys(data).length) throw new BadRequestException('At least one park field must be provided');

    const auditChanges: Prisma.InputJsonObject = {
      fields: Object.keys(data).filter((field) => field !== 'managers'),
      ...(input.managerIds !== undefined ? { managerIds: input.managerIds } : {}),
    };
    return this.auditedTransaction(actor, { action: 'PARK_UPDATED', entity: 'IndustrialPark', entityId: id, changes: auditChanges }, async (tx) => {
      const existing = await tx.industrialPark.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Park not found');
      if (input.code !== undefined) {
        const duplicate = await tx.industrialPark.findUnique({ where: { code: data.code as string } });
        if (duplicate && duplicate.id !== id) throw new ConflictException('A park with this code already exists');
      }
      if (input.managerIds !== undefined) await this.assertManagersValid(input.managerIds, tx);
      await tx.industrialPark.update({ where: { id }, data, select: { id: true } });
      return tx.industrialPark.findUniqueOrThrow({ where: { id }, include: this.parkInclude() });
    });
  }

  async deletePark(actor: AuthenticatedUser, id: string) {
    try {
      return await this.auditedTransaction(actor, { action: 'PARK_DELETED', entity: 'IndustrialPark', entityId: id }, async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "IndustrialPark" WHERE "id" = ${id} FOR UPDATE`);
        if (!locked.length) throw new NotFoundException('Park not found');
        const [park, feedbackCount] = await Promise.all([
          tx.industrialPark.findUnique({
            where: { id },
            select: {
              _count: {
                select: {
                  factories: true,
                  managers: true,
                  announcements: true,
                  advertisements: true,
                  securityGuards: true,
                  scopedFiles: true,
                },
              },
            },
          }),
          tx.feedback.count({ where: { recipientParkId: id } }),
        ]);
        if (!park) throw new NotFoundException('Park not found');
        if (feedbackCount > 0 || Object.values(park._count).some((count) => count > 0)) {
          throw new ConflictException('Park has protected relations and cannot be deleted');
        }
        await tx.industrialPark.delete({ where: { id } });
        return { id, deleted: true };
      });
    } catch (error) {
      const code = error instanceof Prisma.PrismaClientKnownRequestError
        ? error.code
        : typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : undefined;
      if (code === 'P2003') throw new ConflictException('Park has protected relations and cannot be deleted');
      throw error;
    }
  }

  private parkInclude(): Prisma.IndustrialParkInclude {
    return {
      managers: {
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true, phoneNumber: true },
      },
      _count: {
        select: {
          factories: true,
          managers: true,
          announcements: true,
          advertisements: true,
          securityGuards: true,
          scopedFiles: true,
        },
      },
    };
  }

  private async assertManagersValid(managerIds: string[], db: Prisma.TransactionClient) {
    if (!managerIds.length) return;
    if (new Set(managerIds).size !== managerIds.length) throw new BadRequestException('Manager assignments must be unique');
    await db.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" IN (${Prisma.join(managerIds)}) FOR SHARE`);
    const count = await db.user.count({
      where: { id: { in: managerIds }, role: Role.PARK_MANAGER, isActive: true, isApproved: true },
    });
    if (count !== managerIds.length) throw new BadRequestException('One or more managers are invalid');
  }

  private normalizedRequiredText(value: string, field: string): string {
    const normalized = value?.trim();
    if (!normalized) throw new BadRequestException(`${field} is required`);
    return normalized;
  }

  private normalizedNullableText(value: string | null): string | null {
    if (value === null) return null;
    const normalized = value.trim();
    return normalized.length ? normalized : null;
  }

  async listFactories(user: AuthenticatedUser) {
    return this.prisma.factory.findMany({ where: await this.factoryFilter(user), include: { park: true, manager: { select: { id: true, name: true, phoneNumber: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async factoryManagementScope(actor: AuthenticatedUser) {
    const managedParkIds = actor.role === Role.SUPER_ADMIN ? undefined : await this.managedParkIds(actor);
    const parkWhere: Prisma.IndustrialParkWhereInput = {
      status: ParkStatus.ACTIVE,
      ...(managedParkIds ? { id: { in: managedParkIds } } : {}),
    };
    const ownerWhere: Prisma.UserWhereInput = {
      role: Role.FACTORY_OWNER,
      isActive: true,
      isApproved: true,
      ...(actor.role === Role.PARK_MANAGER ? {
        OR: [
          { managedFactories: { none: {} } },
          { managedFactories: { some: { parkId: { in: managedParkIds ?? [] } } } },
        ],
      } : {}),
    };
    const [parks, owners] = await Promise.all([
      this.prisma.industrialPark.findMany({ where: parkWhere, select: { id: true, code: true, name: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
      this.prisma.user.findMany({ where: ownerWhere, select: { id: true, name: true, phoneNumber: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
    ]);
    return { parks, owners };
  }

  async managedFactoryPage(actor: AuthenticatedUser, query: FactoryAdminQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 12));
    return this.prisma.$transaction(async (tx) => {
      const scope = await this.factoryFilter(actor, tx);
      if (query.parkId && actor.role !== Role.SUPER_ADMIN) {
        const allowed = await tx.industrialPark.count({ where: { id: query.parkId, managers: { some: { id: actor.id } } } });
        if (!allowed) throw new ForbiddenException('You do not have access to this factory scope');
      }
      const search = query.search?.trim();
      const where: Prisma.FactoryWhereInput = {
        ...scope,
        ...(query.status ? { status: query.status } : {}),
        ...(query.parkId ? { parkId: query.parkId } : {}),
        ...(buildSemanticContainsOr<Prisma.FactoryWhereInput>(
          ['name', 'licenseNumber', 'nationalId', 'activityType', 'ceoName', 'address'],
          search,
        ) || {}),
      };
      const [items, total] = await Promise.all([
        tx.factory.findMany({
          where,
          select: FACTORY_MANAGEMENT_SELECT,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        tx.factory.count({ where }),
      ]);
      return { items, total, page, pageSize };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async factoryDetail(actor: AuthenticatedUser, id: string) {
    return this.factoryRecord(actor, id, this.prisma);
  }

  async createFactory(actor: AuthenticatedUser, input: CreateFactoryDto) {
    return this.auditedTransaction(
      actor,
      {
        action: 'FACTORY_CREATED',
        entity: 'Factory',
        entityId: (factory: FactoryManagementRecord) => factory.id,
        changes: { parkId: input.parkId, managerId: input.managerId, status: FactoryStatus.PENDING },
      },
      async (tx) => {
        await this.assertFactoryRelations(actor, input.parkId, input.managerId, tx);
        const created = await tx.factory.create({
          data: {
            name: input.name,
            licenseNumber: input.licenseNumber,
            nationalId: input.nationalId,
            activityType: input.activityType,
            address: input.address,
            phoneNumber: input.phoneNumber,
            phoneNumber2: input.phoneNumber2,
            landline: input.landline,
            fax: input.fax,
            email: input.email,
            website: input.website,
            description: input.description,
            licenseExpiry: input.licenseExpiry ? new Date(input.licenseExpiry) : input.licenseExpiry,
            establishedDate: input.establishedDate ? new Date(input.establishedDate) : input.establishedDate,
            employees: input.employees,
            ceoName: input.ceoName,
            shopUrl: input.shopUrl,
            logo: input.logo,
            latitude: input.latitude,
            longitude: input.longitude,
            parkId: input.parkId,
            managerId: input.managerId,
            status: FactoryStatus.PENDING,
            isApproved: false,
          },
          select: { id: true },
        });
        const item = await tx.factory.findUnique({ where: { id: created.id }, select: FACTORY_MANAGEMENT_SELECT });
        if (!item) throw new NotFoundException('Factory not found');
        return item;
      },
    );
  }

  async registerFactory(actor: AuthenticatedUser, input: RegisterFactoryDto) {
    if (actor.role !== Role.FACTORY_OWNER) throw new ForbiddenException('Only factory owners can self-register a factory');
    const park = await this.prisma.industrialPark.findFirst({
      where: { id: input.parkId, status: ParkStatus.ACTIVE },
      select: { id: true },
    });
    if (!park) throw new BadRequestException('Factory park must exist and be active');
    const registered = await this.auditedTransaction(
      actor,
      {
        action: 'FACTORY_REGISTERED',
        entity: 'Factory',
        entityId: (factory: FactoryManagementRecord) => factory.id,
        changes: { parkId: input.parkId, managerId: actor.id, status: FactoryStatus.PENDING },
      },
      async (tx) => {
        const created = await tx.factory.create({
          data: {
            name: input.name,
            licenseNumber: input.licenseNumber,
            nationalId: input.nationalId,
            activityType: input.activityType,
            address: input.address,
            phoneNumber: input.phoneNumber,
            phoneNumber2: input.phoneNumber2,
            landline: input.landline,
            fax: input.fax,
            email: input.email,
            website: input.website,
            description: input.description,
            licenseExpiry: input.licenseExpiry ? new Date(input.licenseExpiry) : input.licenseExpiry,
            establishedDate: input.establishedDate ? new Date(input.establishedDate) : input.establishedDate,
            employees: input.employees,
            ceoName: input.ceoName,
            shopUrl: input.shopUrl,
            logo: input.logo,
            latitude: input.latitude,
            longitude: input.longitude,
            parkId: input.parkId,
            managerId: actor.id,
            status: FactoryStatus.PENDING,
            isApproved: false,
          },
          select: { id: true },
        });
        const item = await tx.factory.findUnique({ where: { id: created.id }, select: FACTORY_MANAGEMENT_SELECT });
        if (!item) throw new NotFoundException('Factory not found');
        return item;
      },
    );
    await this.notifyParkStaff(
      input.parkId,
      { superAdmins: true },
      'ثبت‌نام واحد صنعتی جدید',
      `واحد صنعتی «${input.name}» توسط مدیر واحد (${actor.phoneNumber}) ثبت شد و منتظر بررسی و تایید است.`,
      'WARNING',
    );
    return registered;
  }

  /**
   * In-app notification (and optional SMS) for the park's active managers, and optionally its
   * on-duty security guards, every super admin and specific users. Never throws.
   */
  private async notifyParkStaff(
    parkId: string | null | undefined,
    options: {
      parkManagers?: boolean;
      guards?: boolean;
      superAdmins?: boolean;
      extraUserIds?: Array<string | null | undefined>;
      sms?: string;
      /** Extra numbers (e.g. the park gate phone) that receive the same SMS, de-duplicated. */
      extraPhones?: Array<string | null | undefined>;
    },
    title: string,
    body: string,
    type: 'INFO' | 'SUCCESS' | 'WARNING' = 'INFO',
  ) {
    try {
      const includeManagers = options.parkManagers !== false;
      const recipients = await this.prisma.user.findMany({
        where: {
          isActive: true,
          isApproved: true,
          OR: [
            ...(parkId && includeManagers ? [{ role: Role.PARK_MANAGER, managedParks: { some: { id: parkId } } }] : []),
            ...(parkId && options.guards ? [{ role: Role.SECURITY_GUARD, securityShifts: { some: { parkId, isActive: true } } }] : []),
            ...(options.superAdmins ? [{ role: Role.SUPER_ADMIN }] : []),
            { id: { in: (options.extraUserIds || []).filter((id): id is string => Boolean(id)) } },
          ],
        },
        select: { id: true, phoneNumber: true },
      });
      if (recipients.length) {
        await this.prisma.notification.createMany({
          data: recipients.map((recipient) => ({ userId: recipient.id, title, body, type })),
        });
      }
      if (options.sms) {
        const phones = new Set(
          [...recipients.map((recipient) => recipient.phoneNumber), ...(options.extraPhones || [])]
            .filter((phone): phone is string => Boolean(phone)),
        );
        await Promise.all([...phones].map((phone) => this.safeSendSms(phone, options.sms as string)));
      }
    } catch (error) {
      this.logger.warn(`Park staff notification failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  async updateFactory(actor: AuthenticatedUser, id: string, input: UpdateFactoryDto) {
    if (!Object.keys(input).length) throw new BadRequestException('At least one factory field is required');
    const sensitiveKeys = [
      'name', 'licenseNumber', 'nationalId', 'activityType', 'address',
      'phoneNumber', 'phoneNumber2', 'ceoName', 'landline',
    ] as const;

    return this.auditedTransaction(
      actor,
      {
        action: 'FACTORY_UPDATED',
        entity: 'Factory',
        entityId: id,
        changes: input as unknown as Prisma.InputJsonObject,
      },
      async (tx) => {
        const existing = await this.factoryRecord(actor, id, tx);
        const isOwnerSelfEdit = actor.role === Role.FACTORY_OWNER && existing.managerId === actor.id;
        const canApplyDirect = actor.role === Role.SUPER_ADMIN || actor.role === Role.PARK_MANAGER;

        if (isOwnerSelfEdit && !canApplyDirect) {
          const pending: Record<string, unknown> = {};
          const direct: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(input)) {
            if (value === undefined) continue;
            if ((sensitiveKeys as readonly string[]).includes(key)) pending[key] = value;
            else direct[key] = value;
          }
          const data: Prisma.FactoryUpdateInput = {
            ...direct,
            licenseExpiry: input.licenseExpiry === undefined
              ? undefined
              : input.licenseExpiry
                ? new Date(input.licenseExpiry)
                : null,
            establishedDate: input.establishedDate === undefined
              ? undefined
              : input.establishedDate
                ? new Date(input.establishedDate)
                : null,
            socialMedia: input.socialMedia === undefined
              ? undefined
              : input.socialMedia === null
                ? Prisma.JsonNull
                : (input.socialMedia as Prisma.InputJsonValue),
          };
          if (Object.keys(pending).length) {
            const previous = (existing.pendingChanges && typeof existing.pendingChanges === 'object'
              ? existing.pendingChanges
              : {}) as Record<string, unknown>;
            data.pendingChanges = { ...previous, ...pending } as Prisma.InputJsonValue;
          }
          await tx.factory.update({ where: { id }, data, select: { id: true } });
        } else {
          const data: Prisma.FactoryUpdateInput = {
            ...input,
            licenseExpiry: input.licenseExpiry === undefined
              ? undefined
              : input.licenseExpiry
                ? new Date(input.licenseExpiry)
                : null,
            establishedDate: input.establishedDate === undefined
              ? undefined
              : input.establishedDate
                ? new Date(input.establishedDate)
                : null,
            socialMedia: input.socialMedia === undefined
              ? undefined
              : input.socialMedia === null
                ? Prisma.JsonNull
                : (input.socialMedia as Prisma.InputJsonValue),
          };
          await tx.factory.update({ where: { id }, data, select: { id: true } });
        }
        const item = await tx.factory.findUnique({ where: { id }, select: FACTORY_MANAGEMENT_SELECT });
        if (!item) throw new NotFoundException('Factory not found');
        return item;
      },
    );
  }

  async decidePendingFactoryChanges(actor: AuthenticatedUser, id: string, approved: boolean) {
    if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.PARK_MANAGER) {
      throw new ForbiddenException('Only park managers can decide pending factory changes');
    }
    return this.auditedTransaction(
      actor,
      {
        action: approved ? 'FACTORY_PENDING_CHANGES_APPROVED' : 'FACTORY_PENDING_CHANGES_REJECTED',
        entity: 'Factory',
        entityId: id,
      },
      async (tx) => {
        const existing = await this.factoryRecord(actor, id, tx);
        const pending = existing.pendingChanges;
        if (!pending || typeof pending !== 'object' || Array.isArray(pending)) {
          throw new BadRequestException('No pending changes to decide');
        }
        if (approved) {
          const patch = pending as Record<string, unknown>;
          await tx.factory.update({
            where: { id },
            data: {
              ...(patch as Prisma.FactoryUpdateInput),
              pendingChanges: Prisma.JsonNull,
            },
            select: { id: true },
          });
        } else {
          await tx.factory.update({
            where: { id },
            data: { pendingChanges: Prisma.JsonNull },
            select: { id: true },
          });
        }
        const item = await tx.factory.findUnique({ where: { id }, select: FACTORY_MANAGEMENT_SELECT });
        if (!item) throw new NotFoundException('Factory not found');
        return item;
      },
    );
  }

  async decideFactory(actor: AuthenticatedUser, id: string, approved: boolean, reason?: string) {
    const rejectionReason = reason?.trim();
    if (!approved && !rejectionReason) throw new BadRequestException('A rejection reason is required');
    const finalStatus = approved ? FactoryStatus.ACTIVE : FactoryStatus.INACTIVE;
    const item = await this.auditedTransaction(
      actor,
      {
        action: approved ? 'FACTORY_APPROVED' : 'FACTORY_REJECTED',
        entity: 'Factory',
        entityId: id,
        changes: {
          from: FactoryStatus.PENDING,
          to: finalStatus,
          ...(rejectionReason ? { rejectionReason } : {}),
        },
      },
      async (tx) => {
        const existing = await this.factoryRecord(actor, id, tx);
        if (existing.status !== FactoryStatus.PENDING || existing.isApproved) {
          throw new ConflictException('Factory decision was already recorded');
        }
        const scope = await this.factoryFilter(actor, tx);
        const transition = await tx.factory.updateMany({
          where: { id, status: FactoryStatus.PENDING, isApproved: false, ...scope },
          data: {
            status: finalStatus,
            isApproved: approved,
            rejectionReason: approved ? null : rejectionReason,
            reviewedById: actor.id,
            reviewedAt: new Date(),
          },
        });
        if (transition.count !== 1) throw new ConflictException('Factory decision was already recorded');
        const updated = await tx.factory.findUnique({ where: { id }, select: FACTORY_MANAGEMENT_SELECT });
        if (!updated) throw new NotFoundException('Factory not found');
        return updated;
      },
    );
    const managerPhone = item.manager?.phoneNumber;
    if (managerPhone) {
      const message = approved
        ? `MEKSS: درخواست واحد صنعتی «${item.name}» تایید شد.`
        : `MEKSS: درخواست واحد صنعتی «${item.name}» رد شد.${rejectionReason ? ` دلیل: ${rejectionReason}` : ''}`;
      await this.safeSendSms(managerPhone, message);
    }
    return item;
  }

  async listGatePasses(user: AuthenticatedUser, query: {
    status?: string;
    fromDate?: string;
    toDate?: string;
    driverNationalId?: string;
    licensePlate?: string;
    cargoType?: string;
  } = {}) {
    const factoryIds = await this.factoryIds(user);
    const where: Prisma.GatePassWhereInput = {
      factoryId: { in: factoryIds },
    };
    if (user.role === Role.SECURITY_GUARD) {
      // Guards only work on passes the park manager approved (plus their own exit decisions).
      where.AND = [{
        OR: [
          { status: { in: [GatePassStatus.APPROVED, GatePassStatus.COMPLETED, GatePassStatus.EXPIRED] } },
          { status: GatePassStatus.REJECTED, verifiedById: { not: null } },
        ],
      }];
    }
    if (query.status) where.status = query.status as GatePassStatus;
    if (query.cargoType) where.cargoType = query.cargoType as CargoType;
    if (query.driverNationalId) where.driverNationalId = { contains: query.driverNationalId };
    if (query.licensePlate) where.licensePlate = { contains: query.licensePlate, mode: 'insensitive' };
    if (query.fromDate || query.toDate) where.exitDate = this.dateRangeFilter(query.fromDate, query.toDate);
    return this.prisma.gatePass.findMany({
      where,
      include: {
        factory: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, phoneNumber: true } },
        verifiedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOpenGatePassByPlate(actor: AuthenticatedUser, licensePlate: string) {
    const plate = canonicalPlateOrRaw(String(licensePlate || ''));
    if (!plate) throw new BadRequestException('licensePlate is required');
    const factoryIds = await this.factoryIds(actor);
    const pass = await this.prisma.gatePass.findFirst({
      where: {
        factoryId: { in: factoryIds },
        licensePlate: { equals: plate, mode: 'insensitive' },
        status: actor.role === Role.SECURITY_GUARD
          ? GatePassStatus.APPROVED
          : { in: [GatePassStatus.PENDING, GatePassStatus.APPROVED] },
      },
      include: {
        factory: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!pass) throw new NotFoundException('No open gate pass found for this plate');
    return pass;
  }

  /** Park-manager-approved (awaiting guard) gate passes visible to the actor, projected for ANPR plate matching. */
  async openGatePassPlates(actor: AuthenticatedUser) {
    const factoryIds = await this.factoryIds(actor);
    if (!factoryIds.length) return [];
    return this.prisma.gatePass.findMany({
      where: { factoryId: { in: factoryIds }, status: GatePassStatus.APPROVED },
      select: { id: true, licensePlate: true, plateType: true, factoryId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
  }

  /** Full guard-facing details for gate passes already resolved from the actor's scope. */
  async gatePassesForGuard(actor: AuthenticatedUser, ids: string[]) {
    if (!ids.length) return [];
    const factoryIds = await this.factoryIds(actor);
    return this.prisma.gatePass.findMany({
      where: { id: { in: ids }, factoryId: { in: factoryIds } },
      include: {
        factory: { select: { id: true, name: true, parkId: true } },
        createdBy: { select: { id: true, name: true, phoneNumber: true } },
      },
    });
  }

  async actorParkId(actor: AuthenticatedUser): Promise<string | null> {
    const park = await this.resolveDashboardActivePark(actor, this.prisma as unknown as Prisma.TransactionClient);
    return park?.id ?? null;
  }

  private static readonly REQUIRE_GATE_PASS_WALLET_KEY = 'require_gate_pass_wallet';
  private static readonly FEATURED_ADS_MONTHLY_CAP_KEY = 'advertisement_featured_monthly_cap';
  private static readonly INSUFFICIENT_WALLET_MESSAGE = 'موجودی کیف‌پول برگ خروج کافی نیست. ابتدا کیف‌پول واحد صنعتی را شارژ کنید.';

  private gatePassFee(): number {
    const fee = Number(this.config.get<string>('GATE_PASS_FEE', '50000'));
    if (!Number.isFinite(fee) || fee < 0) throw new BadRequestException('Invalid gate pass fee configuration');
    return fee;
  }

  private async isGatePassWalletRequired(tx?: { appSetting: { findUnique: (args: any) => Promise<{ value: Prisma.JsonValue } | null> } }): Promise<boolean> {
    const client = tx ?? this.prisma;
    const row = await client.appSetting.findUnique({ where: { key: ManagementService.REQUIRE_GATE_PASS_WALLET_KEY } });
    if (!row) return true;
    const value = row.value;
    if (typeof value === 'boolean') return value;
    if (value && typeof value === 'object' && !Array.isArray(value) && 'requireWalletBalance' in value) {
      return Boolean((value as { requireWalletBalance?: unknown }).requireWalletBalance);
    }
    return true;
  }

  async getGatePassWalletSettings() {
    return {
      requireWalletBalance: await this.isGatePassWalletRequired(),
      fee: this.gatePassFee(),
    };
  }

  async updateGatePassWalletSettings(actor: AuthenticatedUser, requireWalletBalance: boolean) {
    if (typeof requireWalletBalance !== 'boolean') {
      throw new BadRequestException('requireWalletBalance must be a boolean');
    }
    await this.prisma.appSetting.upsert({
      where: { key: ManagementService.REQUIRE_GATE_PASS_WALLET_KEY },
      create: {
        key: ManagementService.REQUIRE_GATE_PASS_WALLET_KEY,
        value: { requireWalletBalance },
        updatedById: actor.id,
      },
      update: {
        value: { requireWalletBalance },
        updatedById: actor.id,
      },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'GATE_PASS_WALLET_SETTING_UPDATED',
      entity: 'AppSetting',
      entityId: ManagementService.REQUIRE_GATE_PASS_WALLET_KEY,
      changes: { requireWalletBalance },
    });
    return this.getGatePassWalletSettings();
  }

  private insufficientWalletError() {
    return new BadRequestException({
      message: ManagementService.INSUFFICIENT_WALLET_MESSAGE,
      error: 'INSUFFICIENT_GATE_PASS_WALLET',
    });
  }

  private async featuredAdvertisementMonthlyCap(): Promise<number> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: ManagementService.FEATURED_ADS_MONTHLY_CAP_KEY },
    });
    const value = row?.value;
    if (value && typeof value === 'object' && !Array.isArray(value) && 'monthlyCap' in value) {
      const cap = Number((value as { monthlyCap?: unknown }).monthlyCap);
      if (Number.isFinite(cap) && cap > 0) return Math.min(100, Math.floor(cap));
    }
    return 5;
  }

  private async applyFeaturedPromotion(tx: Prisma.TransactionClient, advertisementId: string) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const cap = await this.featuredAdvertisementMonthlyCap();
    const featuredThisMonth = await tx.advertisement.count({
      where: {
        id: { not: advertisementId },
        isFeatured: true,
        moderatedAt: { gte: monthStart },
      },
    });
    if (featuredThisMonth >= cap) {
      throw new BadRequestException(`Featured advertisement monthly cap (${cap}) reached`);
    }
    const featuredUntil = new Date();
    featuredUntil.setDate(featuredUntil.getDate() + 30);
    await tx.advertisement.update({
      where: { id: advertisementId },
      data: { isFeatured: true, featuredUntil },
    });
  }

  private async resolveDashboardActivePark(
    user: AuthenticatedUser,
    tx: Prisma.TransactionClient,
  ): Promise<{ id: string; name: string; logo: string | null } | null> {
    if (user.role === Role.PARK_MANAGER) {
      const park = await tx.industrialPark.findFirst({
        where: { managers: { some: { id: user.id } }, status: ParkStatus.ACTIVE },
        select: { id: true, name: true, logo: true },
        orderBy: { name: 'asc' },
      });
      return park;
    }
    if (user.role === Role.FACTORY_OWNER || user.role === Role.EMPLOYEE) {
      const factory = user.role === Role.FACTORY_OWNER
        ? await tx.factory.findFirst({
          where: user.activeFactoryId
            ? { managerId: user.id, id: user.activeFactoryId }
            : { managerId: user.id, status: FactoryStatus.ACTIVE, isApproved: true },
          select: { park: { select: { id: true, name: true, logo: true } } },
          orderBy: { name: 'asc' },
        })
        : null;
      const employeeFactory = user.role === Role.EMPLOYEE
        ? await tx.user.findUnique({
          where: { id: user.id },
          select: { employeeOfFactory: { select: { park: { select: { id: true, name: true, logo: true } } } } },
        })
        : null;
      return factory?.park || employeeFactory?.employeeOfFactory?.park || null;
    }
    if (user.role === Role.SECURITY_GUARD) {
      const guard = await tx.securityGuard.findFirst({
        where: { userId: user.id, isActive: true },
        select: { park: { select: { id: true, name: true, logo: true } } },
        orderBy: { shiftStart: 'desc' },
      });
      return guard?.park || null;
    }
    return null;
  }

  async createGatePass(actor: AuthenticatedUser, input: any) {
    for (const key of ['factoryId', 'cargoType', 'driverName', 'driverNationalId', 'driverPhone', 'vehicleType', 'licensePlate', 'exitDate']) this.text(input[key], key);
    await this.assertFactoryAccess(actor, input.factoryId);
    const fee = this.gatePassFee();
    const requireWallet = await this.isGatePassWalletRequired();
    const shouldCharge = requireWallet && fee > 0;
    const parkShareRatio = Math.min(1, Math.max(0, Number(this.config.get<string>('PARK_GATE_PASS_FEE_SHARE', '0.5')) || 0.5));
    const parkShare = shouldCharge ? this.money(fee * parkShareRatio) : 0;
    const feeNote = shouldCharge ? `هزینه مجوز عبور: ${fee}` : undefined;
    const factory = await this.prisma.factory.findUnique({
      where: { id: input.factoryId },
      select: {
        id: true,
        name: true,
        parkId: true,
        phoneNumber: true,
        phoneNumber2: true,
        status: true,
        suspendedReason: true,
        managerId: true,
        manager: { select: { phoneNumber: true, name: true } },
        park: { select: { id: true, name: true, guardPhone: true } },
      },
    });
    if (!factory) throw new NotFoundException('Factory not found');
    this.assertFactoryNotSuspended(factory);

    const pass = await this.prisma.$transaction(async (tx) => {
      if (shouldCharge) {
        const locked = await tx.factory.findUnique({
          where: { id: input.factoryId },
          select: { id: true, gatePassWalletBalance: true },
        });
        if (!locked) throw new NotFoundException('Factory not found');
        if (Number(locked.gatePassWalletBalance) < fee) {
          throw this.insufficientWalletError();
        }
        const deducted = await tx.factory.updateMany({
          where: { id: input.factoryId, gatePassWalletBalance: { gte: fee } },
          data: { gatePassWalletBalance: { decrement: fee } },
        });
        if (deducted.count !== 1) throw this.insufficientWalletError();
        if (parkShare > 0) {
          await tx.industrialPark.update({
            where: { id: factory.parkId },
            data: { gatePassFeeRevenue: { increment: parkShare } },
          });
        }
      }
      return tx.gatePass.create({
        data: {
          factoryId: input.factoryId,
          cargoType: input.cargoType,
          cargoDescription: input.cargoDescription || null,
          driverName: input.driverName,
          driverNationalId: input.driverNationalId,
          driverPhone: input.driverPhone,
          vehicleType: input.vehicleType,
          licensePlate: input.licensePlate,
          plateType: this.plateTypeFor(input.licensePlate, input.plateType),
          licensePlatePhoto: input.licensePlatePhoto || null,
          exitDate: new Date(input.exitDate),
          createdById: actor.id,
          qrCode: `MEKSS-${randomBytes(18).toString('hex')}`,
          notes: feeNote,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          factory: { select: { id: true, name: true } },
        },
      });
    });

    if (input.saveAsDefaultDriver) {
      await this.prisma.user.update({
        where: { id: actor.id },
        data: {
          defaultDriver: {
            driverName: input.driverName,
            driverNationalId: input.driverNationalId,
            driverPhone: input.driverPhone,
            vehicleType: input.vehicleType,
            licensePlate: input.licensePlate,
          },
        },
      });
    }

    // Stage 1: the pass waits for the park manager; the guard is only alerted after approval.
    const passSummary = `واحد «${factory.name}» · راننده ${input.driverName} · پلاک ${input.licensePlate} · تاریخ خروج ${formatJalaliDate(new Date(input.exitDate))}`;
    const smsText = `MEKSS: برگ خروج برای واحد «${factory.name}» ثبت شد و در انتظار تایید مدیر شهرک است. راننده ${input.driverName}، پلاک ${input.licensePlate}.`;
    const phones = new Set<string>();
    if (factory.phoneNumber) phones.add(factory.phoneNumber);
    if (factory.phoneNumber2) phones.add(factory.phoneNumber2);
    if (factory.manager?.phoneNumber) phones.add(factory.manager.phoneNumber);
    await Promise.all([...phones].map((phone) => this.safeSendSms(phone, smsText)));

    await this.notifyParkStaff(
      factory.parkId,
      { sms: `MEKSS: برگ خروج جدید در انتظار تایید شما. ${passSummary}` },
      'برگ خروج در انتظار تایید شما',
      `${passSummary} · ثبت‌کننده: ${pass.createdBy?.name || 'کاربر واحد'}. لطفاً از بخش برگ‌های خروج تایید یا رد کنید.`,
      'WARNING',
    );
    await this.notifyParkStaff(
      null,
      { parkManagers: false, extraUserIds: [factory.managerId] },
      'ثبت برگ خروج جدید',
      `${passSummary} ثبت شد و برای تایید به مدیر شهرک ارسال گردید.`,
      'INFO',
    );

    await this.audit.record({
      userId: actor.id,
      action: 'GATE_PASS_CREATED',
      entity: 'GatePass',
      entityId: pass.id,
      changes: { fee: shouldCharge ? fee : 0, requireWallet, parkShare },
    });
    this.gatePassEvents.emit({ gatePassId: pass.id, factoryId: input.factoryId, kind: 'created' });
    return pass;
  }

  private plateTypeFor(licensePlate: string | undefined, explicit?: string): PlateType {
    if (explicit && Object.values(PlateType).includes(explicit as PlateType)) return explicit as PlateType;
    return (normalizePlate(licensePlate).plateType as PlateType | null) ?? PlateType.PRIVATE;
  }

  async updateGatePass(actor: AuthenticatedUser, id: string, input: {
    cargoType?: string;
    cargoDescription?: string | null;
    driverName?: string;
    driverNationalId?: string;
    driverPhone?: string;
    vehicleType?: string;
    licensePlate?: string;
    plateType?: string;
    licensePlatePhoto?: string;
    exitDate?: string;
  }) {
    const existing = await this.prisma.gatePass.findUnique({
      where: { id },
      include: { factory: { select: { status: true, suspendedReason: true, name: true, parkId: true } } },
    });
    if (!existing) throw new NotFoundException('Gate pass not found');
    await this.assertFactoryAccess(actor, existing.factoryId);
    this.assertFactoryNotSuspended(existing.factory);
    if (existing.status !== GatePassStatus.PENDING && existing.status !== GatePassStatus.REJECTED) {
      throw new ConflictException('Only pending or rejected gate passes can be edited');
    }
    if (!Object.keys(input || {}).length) throw new BadRequestException('At least one gate-pass field is required');

    // Guarded on the status we read so an edit can never land on a pass the park manager approved meanwhile.
    const claimed = await this.prisma.gatePass.updateMany({
      where: { id, status: existing.status },
      data: {
        ...(input.cargoType !== undefined ? { cargoType: input.cargoType as any } : {}),
        ...(input.cargoDescription !== undefined ? { cargoDescription: input.cargoDescription || null } : {}),
        ...(input.driverName !== undefined ? { driverName: input.driverName } : {}),
        ...(input.driverNationalId !== undefined ? { driverNationalId: input.driverNationalId } : {}),
        ...(input.driverPhone !== undefined ? { driverPhone: input.driverPhone } : {}),
        ...(input.vehicleType !== undefined ? { vehicleType: input.vehicleType as any } : {}),
        ...(input.licensePlate !== undefined ? { licensePlate: input.licensePlate } : {}),
        ...(input.licensePlate !== undefined || input.plateType !== undefined
          ? { plateType: this.plateTypeFor(input.licensePlate ?? existing.licensePlate, input.plateType) }
          : {}),
        ...(input.licensePlatePhoto !== undefined ? { licensePlatePhoto: input.licensePlatePhoto || null } : {}),
        ...(input.exitDate !== undefined ? { exitDate: new Date(input.exitDate) } : {}),
        // A corrected rejected pass starts the review again from the park manager.
        ...(existing.status === GatePassStatus.REJECTED
          ? { status: GatePassStatus.PENDING, notes: null, approvedById: null, approvedAt: null, verifiedById: null, verifiedAt: null }
          : {}),
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException('Gate pass status changed while editing; reload and try again');
    }
    const updated = await this.prisma.gatePass.findUniqueOrThrow({ where: { id }, include: { factory: true } });
    await this.audit.record({ userId: actor.id, action: 'GATE_PASS_UPDATED', entity: 'GatePass', entityId: id, changes: input as any });
    this.gatePassEvents.emit({ gatePassId: id, factoryId: existing.factoryId, kind: 'updated' });
    if (existing.status === GatePassStatus.REJECTED) {
      const summary = `واحد «${existing.factory?.name || ''}» · راننده ${updated.driverName} · پلاک ${updated.licensePlate}`;
      await this.notifyParkStaff(
        existing.factory?.parkId,
        { sms: `MEKSS: برگ خروج اصلاح‌شده در انتظار تایید شما. ${summary}` },
        'برگ خروج اصلاح‌شده در انتظار تایید',
        `${summary} پس از اصلاح دوباره ارسال شد. لطفاً بررسی و تایید یا رد کنید.`,
        'WARNING',
      );
    }
    return updated;
  }

  /**
   * Two-stage review:
   *   1. park manager (or super admin): `approve` PENDING → APPROVED, or `reject` PENDING → REJECTED (reason required);
   *   2. security guard (or super admin): `verify` APPROVED → COMPLETED, or `deny` APPROVED → REJECTED (reason required).
   */
  async gatePassAction(actor: AuthenticatedUser, id: string, action: 'approve' | 'reject' | 'verify' | 'deny', reason?: string) {
    const pass = await this.prisma.gatePass.findUnique({
      where: { id },
      include: {
        createdBy: { select: { phoneNumber: true } },
        factory: {
          select: {
            name: true,
            parkId: true,
            managerId: true,
            manager: { select: { id: true, phoneNumber: true } },
            park: { select: { guardPhone: true } },
          },
        },
      },
    });
    if (!pass) throw new NotFoundException('Gate pass not found');
    await this.assertFactoryAccess(actor, pass.factoryId);

    const parkStage = action === 'approve' || action === 'reject';
    if (parkStage && actor.role !== Role.PARK_MANAGER && actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only the park manager can approve or reject a gate pass');
    }
    if (!parkStage && actor.role !== Role.SECURITY_GUARD && actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only security guards can confirm or deny an exit');
    }
    const expectedStatus = parkStage ? GatePassStatus.PENDING : GatePassStatus.APPROVED;
    if (pass.status !== expectedStatus) {
      throw new ConflictException(parkStage
        ? 'Gate pass is not awaiting park manager review'
        : 'Gate pass has not been approved by the park manager yet');
    }
    const cleanReason = reason?.trim().slice(0, 2000);
    if ((action === 'reject' || action === 'deny') && !cleanReason) throw new BadRequestException('A reason is required');

    const now = new Date();
    const data: Prisma.GatePassUncheckedUpdateManyInput =
      action === 'approve'
        ? { status: GatePassStatus.APPROVED, approvedById: actor.id, approvedAt: now }
        : action === 'reject'
          ? { status: GatePassStatus.REJECTED, approvedById: actor.id, approvedAt: now, notes: cleanReason }
          : action === 'verify'
            ? { status: GatePassStatus.COMPLETED, verifiedById: actor.id, verifiedAt: now }
            : { status: GatePassStatus.REJECTED, verifiedById: actor.id, verifiedAt: now, notes: cleanReason };
    // Claim on the expected status so two reviewers cannot both decide the same pass.
    const claimed = await this.prisma.gatePass.updateMany({ where: { id, status: expectedStatus }, data });
    if (claimed.count !== 1) throw new ConflictException('Gate pass was already decided by someone else');
    const updated = await this.prisma.gatePass.findUniqueOrThrow({
      where: { id },
      include: {
        factory: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, phoneNumber: true } },
        approvedBy: { select: { id: true, name: true } },
        verifiedBy: { select: { id: true, name: true } },
      },
    });
    await this.audit.record({
      userId: actor.id,
      action: `GATE_PASS_${action.toUpperCase()}`,
      entity: 'GatePass',
      entityId: id,
      ...(cleanReason ? { changes: { reason: cleanReason } } : {}),
    });
    this.gatePassEvents.emit({ gatePassId: id, factoryId: pass.factoryId, kind: 'decided' });

    const ownerId = pass.factory?.managerId;
    const ownerPhone = pass.factory?.manager?.phoneNumber;
    const parkId = pass.factory?.parkId;
    const summary = `واحد «${pass.factory?.name || ''}» · راننده ${pass.driverName} · پلاک ${pass.licensePlate}`;
    const at = formatJalaliDateTime(now);

    if (action === 'approve') {
      await this.notifyParkStaff(
        parkId,
        {
          parkManagers: false,
          guards: true,
          sms: `MEKSS: برگ خروج تاییدشده آماده بررسی نگهبانی. ${summary}`,
          extraPhones: [pass.factory?.park?.guardPhone],
        },
        'برگ خروج آماده خروج — بررسی نگهبانی',
        `${summary} توسط مدیر شهرک تایید شد (${at}). لطفاً هنگام خروج، مشخصات را تطبیق و خروج را تایید یا رد کنید.`,
        'WARNING',
      );
      if (ownerPhone) await this.safeSendSms(ownerPhone, `MEKSS: برگ خروج ${summary} توسط مدیر شهرک تایید شد و برای نگهبانی ارسال گردید.`);
      if (ownerId) await this.notifyUser(ownerId, 'تایید برگ خروج توسط مدیر شهرک', `${summary} تایید شد و برای نگهبانی ارسال گردید (${at}).`, 'SUCCESS');
    } else if (action === 'reject') {
      if (ownerPhone) await this.safeSendSms(ownerPhone, `MEKSS: برگ خروج ${summary} توسط مدیر شهرک رد شد. دلیل: ${cleanReason}`);
      if (ownerId) await this.notifyUser(ownerId, 'رد برگ خروج توسط مدیر شهرک', `${summary} رد شد (${at}). دلیل: ${cleanReason}. می‌توانید برگ را اصلاح و دوباره ارسال کنید.`, 'WARNING');
    } else if (action === 'verify') {
      const text = `خروج تایید شد · ${summary} · ${at}`;
      if (ownerPhone) await this.safeSendSms(ownerPhone, `MEKSS: ${text}`);
      if (ownerId) await this.notifyUser(ownerId, 'تایید خروج نگهبانی', text, 'SUCCESS');
      await this.notifyParkStaff(parkId, {}, 'تایید خروج نگهبانی', text, 'SUCCESS');
    } else {
      const text = `${summary} در نگهبانی رد شد (${at}). دلیل: ${cleanReason}`;
      if (ownerPhone) await this.safeSendSms(ownerPhone, `MEKSS: خروج ${text}`);
      if (ownerId) await this.notifyUser(ownerId, 'رد خروج در نگهبانی', text, 'WARNING');
      await this.notifyParkStaff(parkId, {}, 'رد خروج در نگهبانی', text, 'WARNING');
    }
    return updated;
  }

  async gatePassByQr(actor: AuthenticatedUser, code: string) {
    const raw = String(code || '').trim();
    if (!raw) throw new NotFoundException('Gate pass not found');
    const include = {
      factory: { select: { id: true, name: true, parkId: true } },
      createdBy: { select: { id: true, name: true, phoneNumber: true } },
    } as const;
    let pass = await this.prisma.gatePass.findUnique({ where: { qrCode: raw }, include });
    if (pass) {
      await this.assertFactoryAccess(actor, pass.factoryId);
      return pass;
    }
    // Fallback: printed gate-pass number (last 8 chars of the id, or a prefix of it), a QR fragment or a plate —
    // only within the actor's own factories so another park's pass never shadows a local one.
    const factoryIds = await this.factoryIds(actor);
    const lower = raw.toLowerCase();
    const candidates = await this.prisma.gatePass.findMany({
      where: {
        factoryId: { in: factoryIds },
        OR: [
          { id: raw },
          { id: { endsWith: lower } },
          { id: { contains: lower } },
          { qrCode: { contains: raw, mode: 'insensitive' } },
          { licensePlate: { contains: raw, mode: 'insensitive' } },
        ],
      },
      include,
      take: 20,
      orderBy: { createdAt: 'desc' },
    });
    const number = (id: string) => id.slice(-8).toLowerCase();
    pass = candidates.find((item) => item.id === raw)
      || candidates.find((item) => number(item.id) === lower)
      || candidates.find((item) => number(item.id).startsWith(lower))
      || candidates.find((item) => item.qrCode?.toLowerCase().endsWith(lower))
      || candidates[0]
      || null;
    if (!pass) throw new NotFoundException('Gate pass not found');
    return pass;
  }

  async gatePassDetail(actor: AuthenticatedUser, id: string) {
    const pass = await this.prisma.gatePass.findUnique({
      where: { id },
      include: {
        factory: true,
        createdBy: { select: { id: true, name: true, phoneNumber: true } },
        approvedBy: { select: { id: true, name: true } },
        verifiedBy: { select: { id: true, name: true } },
      },
    });
    if (!pass) throw new NotFoundException('Gate pass not found');
    await this.assertFactoryAccess(actor, pass.factoryId);
    return pass;
  }

  async listInvoices(user: AuthenticatedUser, query: {
    scope?: 'payable' | 'managed';
    status?: string;
    fromDate?: string;
    toDate?: string;
    minAmount?: number;
    maxAmount?: number;
  } = {}) {
    const resolvedScope = query.scope
      || (user.role === Role.PARK_MANAGER || user.role === Role.SUPER_ADMIN || user.role === Role.GOVERNMENT_OFFICIAL
        ? 'managed'
        : 'payable');
    const where: Prisma.InvoiceWhereInput = {
      ...(await this.invoiceListWhere(user, resolvedScope)),
    };
    if (query.status) where.status = query.status as InvoiceStatus;
    if (query.fromDate || query.toDate) where.issueDate = this.dateRangeFilter(query.fromDate, query.toDate);
    if (query.minAmount != null || query.maxAmount != null) {
      where.totalAmount = {
        ...(query.minAmount != null ? { gte: query.minAmount } : {}),
        ...(query.maxAmount != null ? { lte: query.maxAmount } : {}),
      };
    }
    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        factory: { select: { id: true, name: true, managerId: true, nationalId: true, status: true } },
        park: { select: { id: true, name: true, code: true } },
        payments: true,
        items: { orderBy: { sortOrder: 'asc' } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { issueDate: 'desc' },
    });
    const operablePark = user.role === Role.PARK_MANAGER && resolvedScope === 'managed'
      ? new Set(await this.managedParkIds(user))
      : new Set<string>();
    const openStatuses: InvoiceStatus[] = [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE];
    const permissions = (invoice: { createdById: string; status: InvoiceStatus; targetType: InvoiceTarget; category: InvoiceCategory; parkId: string | null }) => {
      const open = openStatuses.includes(invoice.status);
      const isIssuer = invoice.createdById === user.id;
      const canOperate = open && (
        isIssuer
        || (user.role === Role.PARK_MANAGER && invoice.targetType === InvoiceTarget.FACTORY && invoice.category === InvoiceCategory.CHARGE && Boolean(invoice.parkId && operablePark.has(invoice.parkId)))
        || (user.role === Role.SUPER_ADMIN && invoice.category === InvoiceCategory.PLATFORM)
      );
      return { canEdit: open && isIssuer, canOperate };
    };
    const overdueIds = invoices
      .filter((invoice) => invoice.status === InvoiceStatus.PENDING && this.calendarDaysLate(invoice.dueDate) > 0)
      .map((invoice) => invoice.id);
    if (overdueIds.length) {
      await this.prisma.invoice.updateMany({
        where: { id: { in: overdueIds }, status: InvoiceStatus.PENDING },
        data: { status: InvoiceStatus.OVERDUE },
      });
    }
    return invoices.map((invoice) => {
      const status = overdueIds.includes(invoice.id) ? InvoiceStatus.OVERDUE : invoice.status;
      return {
        ...this.presentInvoice({ ...invoice, status }),
        ...permissions({ ...invoice, status }),
      };
    });
  }

  async invoicePdfPayload(actor: AuthenticatedUser, invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        factory: { select: { id: true, name: true, address: true, nationalId: true, phoneNumber: true } },
        park: { select: { id: true, name: true, code: true, address: true, phoneNumber: true } },
        createdBy: { select: { id: true, name: true } },
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    await this.assertInvoiceAccess(actor, invoice, 'view');
    return this.presentInvoice(invoice);
  }

  async createInvoice(actor: AuthenticatedUser, input: {
    factoryId?: string;
    parkId?: string;
    targetType?: 'FACTORY' | 'PARK';
    items?: Array<Pick<InvoiceItemDto, 'type' | 'title' | 'amount'>>;
    amount?: number;
    taxAmount?: number;
    latePenaltyPerDay?: number;
    description?: string;
    dueDate: string;
  }) {
    const targetType = input.targetType === 'PARK' ? InvoiceTarget.PARK : InvoiceTarget.FACTORY;
    const category = categoryForRole(actor.role);
    const items = input.items?.length ? normalizeInvoiceItems(input.items, category) : null;
    const amount = items ? sumItems(items) : Number(input.amount);
    const taxAmount = Number(input.taxAmount || 0);
    const latePenaltyPerDay = Number(input.latePenaltyPerDay || 0);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(taxAmount) || taxAmount < 0) {
      throw new BadRequestException('Invalid invoice amount');
    }
    if (amount + taxAmount > MAX_INVOICE_AMOUNT) throw new BadRequestException('Invoice total is too large');
    if (!Number.isFinite(latePenaltyPerDay) || latePenaltyPerDay < 0) {
      throw new BadRequestException('Invalid late penalty per day');
    }
    const description = input.description?.trim() || (items ? defaultInvoiceDescription(category, items) : '');
    this.text(description, 'description');
    this.text(input.dueDate, 'dueDate');
    const dueDate = new Date(input.dueDate);
    if (Number.isNaN(dueDate.getTime())) throw new BadRequestException('Invalid due date');
    if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.PARK_MANAGER) {
      throw new ForbiddenException('Only park managers and super admins can issue invoices');
    }

    if (targetType === InvoiceTarget.PARK) {
      if (actor.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException('Only super admins can bill an industrial park');
      }
      if (!input.parkId) throw new BadRequestException('parkId is required for park invoices');
      const park = await this.prisma.industrialPark.findUnique({
        where: { id: input.parkId },
        select: {
          id: true,
          name: true,
          managers: { select: { id: true, phoneNumber: true, isActive: true, isApproved: true } },
        },
      });
      if (!park) throw new NotFoundException('Park not found');

      const invoice = await this.prisma.invoice.create({
        data: this.invoiceCreateData({
          targetType: InvoiceTarget.PARK,
          parkId: park.id,
          factoryId: null,
          category,
          items,
          amount,
          taxAmount,
          latePenaltyPerDay,
          description,
          dueDate,
          createdById: actor.id,
        }),
        include: { park: { select: { id: true, name: true, code: true } }, items: { orderBy: { sortOrder: 'asc' } } },
      });
      await this.audit.record({ userId: actor.id, action: 'PARK_INVOICE_CREATED', entity: 'Invoice', entityId: invoice.id });
      await this.notifyInvoiceIssued(invoice, items, `شهرک «${park.name}»`, park.managers
        .filter((manager) => manager.isActive && manager.isApproved)
        .map((manager) => ({ userId: manager.id, phoneNumber: manager.phoneNumber })));
      return this.presentInvoice(invoice);
    }

    if (!input.factoryId) throw new BadRequestException('factoryId is required for factory invoices');
    await this.assertFactoryAccess(actor, input.factoryId);
    const factory = await this.prisma.factory.findUnique({
      where: { id: input.factoryId },
      select: { id: true, name: true, parkId: true, managerId: true, manager: { select: { phoneNumber: true } } },
    });
    if (!factory) throw new NotFoundException('Factory not found');

    const invoice = await this.prisma.invoice.create({
      data: this.invoiceCreateData({
        targetType: InvoiceTarget.FACTORY,
        factoryId: factory.id,
        parkId: factory.parkId,
        category,
        items,
        amount,
        taxAmount,
        latePenaltyPerDay,
        description,
        dueDate,
        createdById: actor.id,
      }),
      include: { factory: { select: { id: true, name: true, managerId: true } }, items: { orderBy: { sortOrder: 'asc' } } },
    });
    await this.audit.record({ userId: actor.id, action: 'INVOICE_CREATED', entity: 'Invoice', entityId: invoice.id });
    await this.notifyInvoiceIssued(invoice, items, `«${factory.name}»`, factory.managerId
      ? [{ userId: factory.managerId, phoneNumber: factory.manager?.phoneNumber || null }]
      : []);
    return this.presentInvoice(invoice);
  }

  private invoiceCreateData(input: {
    targetType: InvoiceTarget;
    factoryId: string | null;
    parkId: string | null;
    category: InvoiceCategory;
    items: NormalizedInvoiceItem[] | null;
    amount: number;
    taxAmount: number;
    latePenaltyPerDay: number;
    description: string;
    dueDate: Date;
    createdById: string;
    importBatchId?: string;
    parentInvoiceId?: string;
    installmentNo?: number;
  }): Prisma.InvoiceUncheckedCreateInput {
    const prefix = input.targetType === InvoiceTarget.PARK ? 'PINV' : 'INV';
    return {
      targetType: input.targetType,
      factoryId: input.factoryId,
      parkId: input.parkId,
      category: input.category,
      amount: input.amount,
      taxAmount: input.taxAmount,
      totalAmount: this.money(input.amount + input.taxAmount),
      latePenaltyPerDay: input.latePenaltyPerDay,
      latePenaltyAmount: 0,
      description: input.description,
      dueDate: input.dueDate,
      invoiceNumber: `${prefix}-${Date.now()}-${randomBytes(3).toString('hex')}`,
      createdById: input.createdById,
      ...(input.importBatchId ? { importBatchId: input.importBatchId } : {}),
      ...(input.parentInvoiceId ? { parentInvoiceId: input.parentInvoiceId, installmentNo: input.installmentNo ?? null } : {}),
      ...(input.items?.length
        ? { items: { create: input.items.map((item) => ({ type: item.type, title: item.title, amount: item.amount, sortOrder: item.sortOrder })) } }
        : {}),
    };
  }

  private importTarget(actor: AuthenticatedUser, requested?: string): ImportTarget {
    if (actor.role === Role.PARK_MANAGER) {
      if (requested === 'PARK') throw new ForbiddenException('Only super admins can bill industrial parks');
      return 'FACTORY';
    }
    if (actor.role === Role.SUPER_ADMIN) return requested === 'PARK' ? 'PARK' : 'FACTORY';
    throw new ForbiddenException('Only park managers and super admins can import invoices');
  }

  async invoiceImportTemplate(actor: AuthenticatedUser, query: { category?: string; target?: string }) {
    const category = categoryForRole(actor.role);
    if (query.category && query.category !== category) {
      throw new ForbiddenException('This bill category is not available for your role');
    }
    const target = this.importTarget(actor, query.target);
    const buffer = await buildImportTemplate(category, target);
    const fileName = `mekss-${category === InvoiceCategory.PLATFORM ? 'platform' : 'charge'}-${target.toLowerCase()}-template.xlsx`;
    return { buffer, fileName };
  }

  async importInvoices(
    actor: AuthenticatedUser,
    file: { buffer?: Buffer; originalname?: string } | undefined,
    options: { dryRun: boolean; target?: string },
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('فایل ارسال نشده است');
    const category = categoryForRole(actor.role);
    const target = this.importTarget(actor, options.target);
    const fileName = Buffer.from(String(file.originalname || 'invoices.xlsx'), 'latin1').toString('utf8').slice(0, 200);
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const rows = await parseImportWorkbook(file.buffer, category, target);

    type ResolvedTarget = {
      id: string;
      name: string;
      parkId: string | null;
      recipients: Array<{ userId: string; phoneNumber: string | null }>;
    };
    const resolved = new Map<string, ResolvedTarget>();
    const ambiguous = new Set<string>();
    if (target === 'FACTORY') {
      const nationalIds = Array.from(new Set(rows.map((row) => row.key).filter(Boolean)));
      const factories = nationalIds.length
        ? await this.prisma.factory.findMany({
          where: { nationalId: { in: nationalIds }, ...(await this.factoryFilter(actor)) },
          select: { id: true, name: true, nationalId: true, parkId: true, managerId: true, manager: { select: { phoneNumber: true } } },
        })
        : [];
      for (const factory of factories) {
        resolved.set(factory.nationalId, {
          id: factory.id,
          name: factory.name,
          parkId: factory.parkId,
          recipients: factory.managerId ? [{ userId: factory.managerId, phoneNumber: factory.manager?.phoneNumber || null }] : [],
        });
      }
    } else {
      const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLowerCase();
      const parks = await this.prisma.industrialPark.findMany({
        select: { id: true, name: true, managers: { select: { id: true, phoneNumber: true, isActive: true, isApproved: true } } },
      });
      for (const park of parks) {
        const key = normalizeName(park.name);
        if (resolved.has(key)) ambiguous.add(key);
        resolved.set(key, {
          id: park.id,
          name: park.name,
          parkId: park.id,
          recipients: park.managers
            .filter((manager) => manager.isActive && manager.isApproved)
            .map((manager) => ({ userId: manager.id, phoneNumber: manager.phoneNumber })),
        });
      }
      for (const row of rows) row.key = row.key ? normalizeName(row.key) : row.key;
    }

    const preview = rows.map((row) => {
      const errors = [...row.errors];
      const match = row.key ? resolved.get(row.key) : undefined;
      if (row.key && !errors.some((error) => error.startsWith('شناسه ملی واحد باید'))) {
        if (ambiguous.has(row.key)) errors.push('چند شهرک با این نام وجود دارد؛ نام را دقیق‌تر کنید');
        else if (!match) {
          errors.push(target === 'FACTORY'
            ? 'واحدی با این شناسه ملی پیدا نشد یا در محدودهٔ شما نیست'
            : 'شهرکی با این نام پیدا نشد');
        }
      }
      return {
        rowNumber: row.rowNumber,
        key: row.key,
        targetId: match?.id || null,
        targetName: match?.name || null,
        items: row.items.map((item) => ({ ...item, label: INVOICE_ITEM_LABELS_FA[item.type] })),
        total: row.total,
        dueDate: row.dueDate,
        dueDateJalali: row.dueDateJalali,
        latePenaltyPerDay: row.latePenaltyPerDay,
        description: row.description,
        errors,
      };
    });
    const valid = preview.filter((row) => !row.errors.length);
    const summary = {
      rowCount: preview.length,
      validCount: valid.length,
      errorCount: preview.length - valid.length,
      totalAmount: this.money(valid.reduce((sum, row) => sum + row.total, 0)),
    };
    const previous = await this.prisma.invoiceImportBatch.findUnique({
      where: { createdById_fileHash: { createdById: actor.id, fileHash } },
      select: { id: true, createdAt: true, rowCount: true },
    });

    if (options.dryRun) {
      return { dryRun: true, category, target, fileName, alreadyImported: Boolean(previous), previousImportAt: previous?.createdAt ?? null, summary, rows: preview };
    }
    if (previous) throw new ConflictException('این فایل قبلاً ثبت شده است و دوباره وارد نمی‌شود');
    if (summary.errorCount > 0) {
      throw new BadRequestException(`${summary.errorCount} ردیف خطا دارد؛ هیچ قبضی ثبت نشد. پیش‌نمایش را بررسی و فایل را اصلاح کنید.`);
    }

    const targetType = target === 'PARK' ? InvoiceTarget.PARK : InvoiceTarget.FACTORY;
    let result: { batchId: string; invoices: Array<{ id: string; invoiceNumber: string; totalAmount: Prisma.Decimal; dueDate: Date; latePenaltyPerDay: Prisma.Decimal; key: string; items: NormalizedInvoiceItem[] }> };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const batch = await tx.invoiceImportBatch.create({
          data: { createdById: actor.id, fileName, fileHash, category, rowCount: preview.length },
        });
        const invoices = [];
        for (const row of preview) {
          const match = resolved.get(row.key) as ResolvedTarget;
          const items: NormalizedInvoiceItem[] = row.items.map((item, index) => ({ type: item.type, title: item.title, amount: item.amount, sortOrder: index }));
          const invoice = await tx.invoice.create({
            data: this.invoiceCreateData({
              targetType,
              factoryId: targetType === InvoiceTarget.FACTORY ? match.id : null,
              parkId: match.parkId,
              category,
              items,
              amount: row.total,
              taxAmount: 0,
              latePenaltyPerDay: row.latePenaltyPerDay,
              description: row.description || defaultInvoiceDescription(category, items),
              dueDate: new Date(String(row.dueDate)),
              createdById: actor.id,
              importBatchId: batch.id,
            }),
            select: { id: true, invoiceNumber: true, totalAmount: true, dueDate: true, latePenaltyPerDay: true },
          });
          invoices.push({ ...invoice, key: row.key, items });
        }
        return { batchId: batch.id, invoices };
      }, { timeout: 180_000, maxWait: 10_000 });
    } catch (error) {
      if (this.prismaErrorCode(error) === 'P2002') throw new ConflictException('این فایل قبلاً ثبت شده است و دوباره وارد نمی‌شود');
      throw error;
    }

    await this.audit.record({
      userId: actor.id,
      action: 'INVOICES_IMPORTED',
      entity: 'InvoiceImportBatch',
      entityId: result.batchId,
      changes: { fileName, category, target, count: result.invoices.length, totalAmount: summary.totalAmount },
    });
    void (async () => {
      for (const invoice of result.invoices) {
        const match = resolved.get(invoice.key) as ResolvedTarget;
        await this.notifyInvoiceIssued(invoice, invoice.items, target === 'PARK' ? `شهرک «${match.name}»` : `«${match.name}»`, match.recipients);
      }
    })().catch((error) => this.logger.warn(`Import notifications failed: ${error instanceof Error ? error.message : 'unknown error'}`));

    return { dryRun: false, category, target, fileName, batchId: result.batchId, created: result.invoices.length, totalAmount: summary.totalAmount };
  }

  /** SMS + in-app notice with line items, due date and the daily penalty. */
  private async notifyInvoiceIssued(
    invoice: { invoiceNumber: string; totalAmount: Prisma.Decimal | number; dueDate: Date; latePenaltyPerDay: Prisma.Decimal | number },
    items: Array<{ type: InvoiceItemType; title?: string | null; amount: number }> | null,
    subject: string,
    recipients: Array<{ userId: string; phoneNumber: string | null }>,
  ) {
    const total = formatRial(Number(invoice.totalAmount));
    const perDay = Number(invoice.latePenaltyPerDay || 0);
    const dueNote = ` مهلت پرداخت: ${formatJalaliDate(invoice.dueDate)}.`;
    const penaltyNote = perDay > 0 ? ` در صورت تأخیر، جریمه روزانه ${formatRial(perDay)} ریال اعمال می‌شود.` : '';
    const itemsNote = items?.length ? ` (${itemsSummaryFa(items)})` : '';
    await Promise.all(recipients.map(async (recipient) => {
      if (recipient.phoneNumber) {
        await this.safeSendSms(
          recipient.phoneNumber,
          `MEKSS: صورتحساب جدید برای ${subject} به مبلغ ${total} ریال ثبت شد.${dueNote}${penaltyNote}`,
        );
      }
      await this.notifyUser(
        recipient.userId,
        'صورتحساب جدید',
        `صورتحساب «${invoice.invoiceNumber}» برای ${subject} به مبلغ ${total} ریال${itemsNote} صادر شد.${dueNote}${penaltyNote}`,
        'WARNING',
      );
    }));
  }

  async updateInvoice(actor: AuthenticatedUser, id: string, input: {
    amount?: number;
    taxAmount?: number;
    latePenaltyPerDay?: number;
    description?: string;
    dueDate?: string;
    status?: 'PENDING' | 'OVERDUE' | 'CANCELLED';
    items?: Array<Pick<InvoiceItemDto, 'type' | 'title' | 'amount'>>;
  }) {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!existing) throw new NotFoundException('Invoice not found');
    await this.assertInvoiceOperator(actor, existing, 'edit');
    if (existing.status === InvoiceStatus.PAID) throw new ConflictException('Paid invoices cannot be edited');
    this.assertInvoiceMutable(existing.status);
    if (!Object.keys(input || {}).length) throw new BadRequestException('At least one invoice field is required');
    await this.assertNoPaymentInFlight(id);

    const existingItems = existing.items || [];
    const carriedItems = existingItems.filter((item) => item.type === InvoiceItemType.CARRIED_PENALTY);
    let items: NormalizedInvoiceItem[] | null = null;
    if (input.items !== undefined) {
      const editable = (input.items || []).filter((item) => item.type !== InvoiceItemType.CARRIED_PENALTY);
      items = [
        ...normalizeInvoiceItems(editable, existing.category),
        // Carried late penalty of a split invoice is preserved untouched.
        ...carriedItems.map((item) => ({ type: item.type, title: item.title, amount: Number(item.amount), sortOrder: 0 })),
      ].map((item, index) => ({ ...item, sortOrder: index }));
    } else if (input.amount !== undefined && existingItems.length) {
      throw new BadRequestException('This invoice has line items; edit the items instead of the amount');
    }

    const amount = items ? sumItems(items) : (input.amount !== undefined ? Number(input.amount) : Number(existing.amount));
    const taxAmount = input.taxAmount !== undefined ? Number(input.taxAmount) : Number(existing.taxAmount);
    const latePenaltyPerDay = input.latePenaltyPerDay !== undefined
      ? Number(input.latePenaltyPerDay)
      : Number(existing.latePenaltyPerDay);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(taxAmount) || taxAmount < 0) {
      throw new BadRequestException('Invalid invoice amount');
    }
    if (amount + taxAmount > MAX_INVOICE_AMOUNT) throw new BadRequestException('Invoice total is too large');
    if (!Number.isFinite(latePenaltyPerDay) || latePenaltyPerDay < 0) {
      throw new BadRequestException('Invalid late penalty per day');
    }
    const discountAmount = Number(existing.discountAmount || 0);
    if (discountAmount > this.money(amount + taxAmount - this.carriedPenaltyTotal(items ?? existingItems))) {
      throw new BadRequestException('The existing discount is larger than the new base amount');
    }
    // Status-independent on purpose: cancel → edit → reopen must not erase an accrued penalty.
    const penaltyStarted = this.calendarDaysLate(existing.penaltyStartsAt ?? existing.dueDate) > 0;
    if (penaltyStarted && latePenaltyPerDay < Number(existing.latePenaltyPerDay)) {
      throw new BadRequestException('The daily late penalty cannot be reduced after the penalty has started');
    }

    let dueDate = existing.dueDate;
    let penaltyStartsAt = existing.penaltyStartsAt;
    if (input.dueDate !== undefined) {
      dueDate = new Date(input.dueDate);
      if (Number.isNaN(dueDate.getTime())) throw new BadRequestException('Invalid due date');
      penaltyStartsAt = this.preservedPenaltyStart(existing, dueDate);
    }
    let nextStatus = input.status !== undefined ? (input.status as InvoiceStatus) : existing.status;
    if (nextStatus === InvoiceStatus.PENDING && this.calendarDaysLate(dueDate) > 0) {
      nextStatus = InvoiceStatus.OVERDUE;
    }
    if (nextStatus === InvoiceStatus.OVERDUE && this.calendarDaysLate(dueDate) === 0 && input.status === undefined) {
      nextStatus = InvoiceStatus.PENDING;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (items) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceItem.createMany({
          data: items.map((item) => ({ invoiceId: id, type: item.type, title: item.title, amount: item.amount, sortOrder: item.sortOrder })),
        });
      }
      const row = await tx.invoice.update({
        where: { id },
        data: {
          amount,
          taxAmount,
          totalAmount: this.money(amount + taxAmount - discountAmount),
          latePenaltyPerDay,
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.dueDate !== undefined ? { dueDate, penaltyStartsAt } : {}),
          status: nextStatus,
        },
        include: { factory: true, items: { orderBy: { sortOrder: 'asc' } } },
      });
      await tx.invoiceAdjustment.create({
        data: {
          invoiceId: id,
          actorId: actor.id,
          type: InvoiceAdjustmentType.EDIT,
          amount: this.money(amount + taxAmount),
          fromDueDate: input.dueDate !== undefined ? existing.dueDate : null,
          toDueDate: input.dueDate !== undefined ? dueDate : null,
          details: {
            previous: {
              amount: Number(existing.amount),
              taxAmount: Number(existing.taxAmount),
              latePenaltyPerDay: Number(existing.latePenaltyPerDay),
              description: existing.description,
              status: existing.status,
            },
          } as Prisma.InputJsonObject,
        },
      });
      return row;
    });
    await this.audit.record({ userId: actor.id, action: 'INVOICE_UPDATED', entity: 'Invoice', entityId: id, changes: input as any });
    return this.presentInvoice(updated);
  }

  async invoiceAdjustments(actor: AuthenticatedUser, id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    await this.assertInvoiceAccess(actor, invoice, 'view');
    const [adjustments, installments] = await Promise.all([
      this.prisma.invoiceAdjustment.findMany({
        where: { invoiceId: id },
        include: { actor: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.findMany({
        where: { parentInvoiceId: id },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { installmentNo: 'asc' },
      }),
    ]);
    return {
      adjustments: adjustments.map((row) => ({ ...row, amount: row.amount === null ? null : Number(row.amount) })),
      installments: installments.map((row) => this.presentInvoice(row)),
    };
  }

  async discountInvoice(actor: AuthenticatedUser, id: string, input: InvoiceDiscountDto) {
    const existing = await this.prisma.invoice.findUnique({ where: { id }, include: { items: true } });
    if (!existing) throw new NotFoundException('Invoice not found');
    await this.assertInvoiceOperator(actor, existing, 'finance');
    this.assertInvoiceOpen(existing.status);
    await this.assertNoPaymentInFlight(id);
    const discountAmount = this.money(Number(input.discountAmount));
    const base = this.money(Number(existing.amount) + Number(existing.taxAmount));
    const discountable = this.money(base - this.carriedPenaltyTotal(existing.items));
    if (!Number.isFinite(discountAmount) || discountAmount < 0) throw new BadRequestException('Invalid discount amount');
    if (discountAmount > discountable) {
      throw new BadRequestException('Discount cannot exceed the base amount (amount + tax); the late penalty is never discounted');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.invoice.update({
        where: { id },
        data: { discountAmount, totalAmount: this.money(base - discountAmount) },
        include: { factory: true, items: { orderBy: { sortOrder: 'asc' } } },
      });
      await tx.invoiceAdjustment.create({
        data: {
          invoiceId: id,
          actorId: actor.id,
          type: InvoiceAdjustmentType.DISCOUNT,
          amount: discountAmount,
          note: input.note || null,
          details: { previousDiscount: Number(existing.discountAmount || 0), base } as Prisma.InputJsonObject,
        },
      });
      return row;
    });
    await this.audit.record({ userId: actor.id, action: 'INVOICE_DISCOUNTED', entity: 'Invoice', entityId: id, changes: { discountAmount } });
    await this.notifyInvoicePayers(existing, 'تخفیف قبض', `برای قبض «${existing.invoiceNumber}» تخفیف ${formatRial(discountAmount)} ریال اعمال شد.`, 'INFO');
    return this.presentInvoice(updated);
  }

  async extendInvoiceDueDate(actor: AuthenticatedUser, id: string, input: InvoiceExtendDueDto) {
    const existing = await this.prisma.invoice.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Invoice not found');
    await this.assertInvoiceOperator(actor, existing, 'finance');
    this.assertInvoiceOpen(existing.status);
    await this.assertNoPaymentInFlight(id);
    const dueDate = new Date(input.dueDate);
    if (Number.isNaN(dueDate.getTime())) throw new BadRequestException('Invalid due date');
    if (calendarDaysLate(dueDate) > 0) throw new BadRequestException('The new due date cannot be in the past');
    if (dueDate.getTime() <= existing.dueDate.getTime()) {
      throw new BadRequestException('The new due date must be after the current due date');
    }
    const before = this.computeInvoiceSettlement(existing);
    const penaltyStartsAt = this.preservedPenaltyStart(existing, dueDate);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.invoice.update({
        where: { id },
        data: { dueDate, penaltyStartsAt, status: InvoiceStatus.PENDING },
        include: { factory: true, items: { orderBy: { sortOrder: 'asc' } } },
      });
      await tx.invoiceAdjustment.create({
        data: {
          invoiceId: id,
          actorId: actor.id,
          type: InvoiceAdjustmentType.EXTENSION,
          fromDueDate: existing.dueDate,
          toDueDate: dueDate,
          note: input.note || null,
          details: {
            penaltyStartsAt: penaltyStartsAt ? penaltyStartsAt.toISOString() : null,
            accruedLateDays: before.lateDays,
            accruedLatePenalty: before.latePenaltyAmount,
          } as Prisma.InputJsonObject,
        },
      });
      return row;
    });
    await this.audit.record({
      userId: actor.id,
      action: 'INVOICE_DUE_EXTENDED',
      entity: 'Invoice',
      entityId: id,
      changes: { from: existing.dueDate.toISOString(), to: dueDate.toISOString(), penaltyContinues: Boolean(penaltyStartsAt) },
    });
    const penaltyNote = penaltyStartsAt
      ? ` جریمهٔ تأخیر از ${formatJalaliDate(penaltyStartsAt)} همچنان محاسبه می‌شود.`
      : '';
    await this.notifyInvoicePayers(
      existing,
      'تمدید مهلت پرداخت',
      `مهلت پرداخت قبض «${existing.invoiceNumber}» تا ${formatJalaliDate(dueDate)} تمدید شد.${penaltyNote}`,
      'INFO',
    );
    return this.presentInvoice(updated);
  }

  async splitInvoiceIntoInstallments(actor: AuthenticatedUser, id: string, input: InvoiceInstallmentsDto) {
    const existing = await this.prisma.invoice.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Invoice not found');
    await this.assertInvoiceOperator(actor, existing, 'finance');
    this.assertInvoiceOpen(existing.status);
    if (existing.parentInvoiceId) throw new BadRequestException('An installment cannot be split again');
    await this.assertNoPaymentInFlight(id);

    const settlement = this.computeInvoiceSettlement(existing);
    const base = settlement.baseTotal;
    const carriedPenalty = settlement.latePenaltyAmount;
    if (base <= 0) throw new BadRequestException('Nothing left to split');

    let schedule: Array<{ amount: number; dueDate: Date }>;
    if (input.installments?.length) {
      if (input.installments.length < 2) throw new BadRequestException('At least two installments are required');
      schedule = input.installments.map((row) => ({ amount: this.money(Number(row.amount)), dueDate: new Date(row.dueDate) }));
      const total = this.money(schedule.reduce((sum, row) => sum + row.amount, 0));
      if (total !== base) {
        throw new BadRequestException(`Installments must add up exactly to ${base} (got ${total})`);
      }
    } else {
      const count = Number(input.count);
      if (!Number.isInteger(count) || count < 2 || count > 36) throw new BadRequestException('count must be between 2 and 36');
      const first = new Date(String(input.firstDueDate || ''));
      const interval = Number(input.intervalDays || 30);
      schedule = splitEvenly(base, count).map((amount, index) => ({ amount, dueDate: addDays(first, index * interval) }));
    }
    schedule.forEach((row, index) => {
      if (Number.isNaN(row.dueDate.getTime())) throw new BadRequestException(`Invalid due date for installment ${index + 1}`);
      if (!(row.amount > 0)) throw new BadRequestException(`Invalid amount for installment ${index + 1}`);
      if (calendarDaysLate(row.dueDate) > 0) throw new BadRequestException(`Installment ${index + 1} due date cannot be in the past`);
      if (index > 0 && row.dueDate.getTime() < schedule[index - 1].dueDate.getTime()) {
        throw new BadRequestException('Installment due dates must be in chronological order');
      }
    });

    const shareType = existing.category === InvoiceCategory.PLATFORM ? InvoiceItemType.PLATFORM_OTHER : InvoiceItemType.CHARGE_OTHER;
    const count = schedule.length;
    const children = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.invoice.updateMany({
        where: { id, status: { in: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE] } },
        data: { status: InvoiceStatus.INSTALLMENTS, lateDays: settlement.lateDays, latePenaltyAmount: carriedPenalty },
      });
      if (claimed.count !== 1) throw new ConflictException('Invoice status changed; reload and try again');
      const created = [];
      for (const [index, row] of schedule.entries()) {
        const items: NormalizedInvoiceItem[] = [
          { type: shareType, title: `قسط ${index + 1} از ${count} قبض ${existing.invoiceNumber}`, amount: row.amount, sortOrder: 0 },
        ];
        if (index === 0 && carriedPenalty > 0) {
          items.push({ type: InvoiceItemType.CARRIED_PENALTY, title: INVOICE_ITEM_LABELS_FA.CARRIED_PENALTY, amount: carriedPenalty, sortOrder: 1 });
        }
        created.push(await tx.invoice.create({
          data: this.invoiceCreateData({
            targetType: existing.targetType,
            factoryId: existing.factoryId,
            parkId: existing.parkId,
            category: existing.category,
            items,
            amount: sumItems(items),
            taxAmount: 0,
            // Proportional share, so all installments together never accrue more than the original rate.
            latePenaltyPerDay: this.money(Number(existing.latePenaltyPerDay || 0) * row.amount / base),
            description: `قسط ${index + 1} از ${count} — ${existing.description}`.slice(0, 2000),
            dueDate: row.dueDate,
            createdById: existing.createdById,
            parentInvoiceId: existing.id,
            installmentNo: index + 1,
          }),
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        }));
      }
      await tx.invoiceAdjustment.create({
        data: {
          invoiceId: id,
          actorId: actor.id,
          type: InvoiceAdjustmentType.INSTALLMENT,
          amount: base,
          note: input.note || null,
          details: {
            count,
            carriedPenalty,
            lateDays: settlement.lateDays,
            installments: created.map((child) => ({ id: child.id, invoiceNumber: child.invoiceNumber, amount: Number(child.totalAmount), dueDate: child.dueDate.toISOString() })),
          } as Prisma.InputJsonObject,
        },
      });
      return created;
    }, { timeout: 30_000 });
    await this.audit.record({ userId: actor.id, action: 'INVOICE_SPLIT_INSTALLMENTS', entity: 'Invoice', entityId: id, changes: { count, carriedPenalty } });
    await this.notifyInvoicePayers(
      existing,
      'تقسیط قبض',
      `قبض «${existing.invoiceNumber}» به ${count} قسط تقسیم شد. اولین قسط: ${formatRial(Number(children[0].totalAmount))} ریال تا ${formatJalaliDate(children[0].dueDate)}.`,
      'INFO',
    );
    return { parentId: id, installments: children.map((child) => this.presentInvoice(child)) };
  }

  async settleInvoiceManually(actor: AuthenticatedUser, id: string, input: InvoiceSettleDto) {
    const existing = await this.prisma.invoice.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Invoice not found');
    await this.assertInvoiceOperator(actor, existing, 'finance');
    this.assertInvoiceOpen(existing.status);
    await this.assertNoPaymentInFlight(id);
    const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) throw new BadRequestException('Invalid payment date');
    if (paidAt.getTime() > Date.now() + 5 * 60_000) throw new BadRequestException('Payment date cannot be in the future');
    if (existing.issueDate && calendarDaysLate(paidAt, existing.issueDate) > 0) {
      throw new BadRequestException('Payment date cannot be before the invoice issue date');
    }
    const settlement = this.computeInvoiceSettlement(existing, paidAt);

    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.invoice.updateMany({
        where: { id, status: { in: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE] } },
        data: {
          status: InvoiceStatus.PAID,
          paymentDate: paidAt,
          paymentMethod: `MANUAL_${input.method}`,
          lateDays: settlement.lateDays,
          latePenaltyAmount: settlement.latePenaltyAmount,
        },
      });
      if (claimed.count !== 1) throw new ConflictException('Invoice status changed; reload and try again');
      await tx.invoiceAdjustment.create({
        data: {
          invoiceId: id,
          actorId: actor.id,
          type: InvoiceAdjustmentType.SETTLEMENT,
          amount: settlement.payableAmount,
          note: input.note || null,
          details: {
            method: input.method,
            reference: input.reference || null,
            paidAt: paidAt.toISOString(),
            baseTotal: settlement.baseTotal,
            lateDays: settlement.lateDays,
            latePenaltyAmount: settlement.latePenaltyAmount,
          } as Prisma.InputJsonObject,
        },
      });
      if (existing.parentInvoiceId) await this.completeInstallmentParent(tx, existing.parentInvoiceId);
      return tx.invoice.findUniqueOrThrow({ where: { id }, include: { factory: true, items: { orderBy: { sortOrder: 'asc' } } } });
    });
    await this.audit.record({
      userId: actor.id,
      action: 'INVOICE_SETTLED_MANUALLY',
      entity: 'Invoice',
      entityId: id,
      changes: { method: input.method, payableAmount: settlement.payableAmount, latePenaltyAmount: settlement.latePenaltyAmount },
    });
    await this.notifyInvoicePayers(
      existing,
      'تسویه قبض',
      `قبض «${existing.invoiceNumber}» با مبلغ ${formatRial(settlement.payableAmount)} ریال تسویه شد.`,
      'SUCCESS',
    );
    return this.presentInvoice(updated);
  }

  /** Marks a split parent PAID once every installment is paid. */
  private async completeInstallmentParent(tx: Prisma.TransactionClient, parentId: string) {
    const unpaid = await tx.invoice.count({
      where: { parentInvoiceId: parentId, status: { not: InvoiceStatus.PAID } },
    });
    if (unpaid > 0) return;
    await tx.invoice.updateMany({
      where: { id: parentId, status: InvoiceStatus.INSTALLMENTS },
      data: { status: InvoiceStatus.PAID, paymentDate: new Date(), paymentMethod: 'INSTALLMENTS' },
    });
  }

  /** A split parent (open or completed) whose amount is already carried by its installments. */
  private isSplitParent(invoice: { status: InvoiceStatus; paymentMethod?: string | null }) {
    return invoice.status === InvoiceStatus.INSTALLMENTS
      || (invoice.status === InvoiceStatus.PAID && invoice.paymentMethod === 'INSTALLMENTS');
  }

  private async assertNoPaymentInFlight(invoiceId: string) {
    const inFlight = await this.prisma.paymentTransaction.count({
      where: { invoiceId, status: PaymentStatus.INITIATED, createdAt: { gte: new Date(Date.now() - 30 * 60_000) } },
    });
    if (inFlight > 0) {
      throw new ConflictException('An online payment for this invoice is in progress; try again in a few minutes');
    }
  }

  private assertInvoiceMutable(status: InvoiceStatus) {
    if (status === InvoiceStatus.INSTALLMENTS) throw new ConflictException('This invoice was split into installments; manage the installments instead');
    if (status === InvoiceStatus.AWAITING_CONFIRMATION) throw new ConflictException('This invoice has a payment awaiting confirmation');
  }

  private assertInvoiceOpen(status: InvoiceStatus) {
    if (status === InvoiceStatus.PAID) throw new ConflictException('Paid invoices cannot be changed');
    if (status === InvoiceStatus.CANCELLED) throw new ConflictException('Cancelled invoices cannot be changed');
    this.assertInvoiceMutable(status);
  }

  private carriedPenaltyTotal(items: Array<{ type: InvoiceItemType; amount: Prisma.Decimal | number }> | null | undefined): number {
    return this.money((items || [])
      .filter((item) => item.type === InvoiceItemType.CARRIED_PENALTY)
      .reduce((sum, item) => sum + Number(item.amount), 0));
  }

  /**
   * Moving the due date never erases an accrued penalty: once late days exist, the
   * penalty keeps counting from its original start (unless the new date is even earlier).
   */
  private preservedPenaltyStart(existing: { dueDate: Date; penaltyStartsAt: Date | null }, nextDueDate: Date): Date | null {
    const anchor = existing.penaltyStartsAt ?? existing.dueDate;
    if (calendarDaysLate(anchor) === 0) return null;
    return nextDueDate.getTime() <= anchor.getTime() ? null : anchor;
  }

  /**
   * Edit: only the issuer. Financial operations: the issuer, park managers of the
   * unit's park for charge bills, and any super admin for platform bills.
   */
  private async assertInvoiceOperator(
    actor: AuthenticatedUser,
    invoice: { createdById: string; targetType: InvoiceTarget; category: InvoiceCategory; factoryId: string | null; parkId: string | null },
    operation: 'edit' | 'finance',
  ) {
    if (invoice.createdById === actor.id) {
      await this.assertInvoiceAccess(actor, invoice, 'manage');
      return;
    }
    if (operation === 'edit') throw new ForbiddenException('Only the issuer of this invoice can edit it');
    if (
      actor.role === Role.PARK_MANAGER
      && invoice.targetType === InvoiceTarget.FACTORY
      && invoice.category === InvoiceCategory.CHARGE
      && invoice.parkId
    ) {
      await this.assertParkScope(actor, invoice.parkId);
      return;
    }
    if (actor.role === Role.SUPER_ADMIN && invoice.category === InvoiceCategory.PLATFORM) return;
    throw new ForbiddenException('You cannot manage this invoice');
  }

  private async notifyInvoicePayers(
    invoice: { targetType: InvoiceTarget; factoryId: string | null; parkId: string | null },
    title: string,
    body: string,
    type: 'INFO' | 'SUCCESS' | 'WARNING',
  ) {
    try {
      const userIds = invoice.targetType === InvoiceTarget.PARK
        ? (invoice.parkId
          ? (await this.prisma.user.findMany({
            where: { role: Role.PARK_MANAGER, isActive: true, managedParks: { some: { id: invoice.parkId } } },
            select: { id: true },
          })).map((user) => user.id)
          : [])
        : (invoice.factoryId
          ? [(await this.prisma.factory.findUnique({ where: { id: invoice.factoryId }, select: { managerId: true } }))?.managerId].filter((value): value is string => Boolean(value))
          : []);
      await Promise.all(userIds.map((userId) => this.notifyUser(userId, title, body, type)));
    } catch (error) {
      this.logger.warn(`Invoice notification failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  async startPayment(actor: AuthenticatedUser, invoiceId: string, idempotencyKey?: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { factory: { select: { parkId: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    await this.assertInvoiceAccess(actor, invoice, 'pay');
    if (invoice.status === InvoiceStatus.PAID) throw new BadRequestException('Invoice already paid');
    if (invoice.status === InvoiceStatus.CANCELLED) throw new BadRequestException('Cancelled invoices cannot be paid');
    if (invoice.status !== InvoiceStatus.PENDING && invoice.status !== InvoiceStatus.OVERDUE) {
      throw new BadRequestException('Invoice cannot be paid');
    }

    const settlement = this.computeInvoiceSettlement(invoice);
    if (settlement.payableAmount <= 0) throw new BadRequestException('Nothing to pay online for this invoice');
    if (invoice.status === InvoiceStatus.PENDING && settlement.status === InvoiceStatus.OVERDUE) {
      await this.prisma.invoice.update({ where: { id: invoice.id }, data: { status: InvoiceStatus.OVERDUE } });
    }

    const key = idempotencyKey || `${invoiceId}:${actor.id}:${settlement.payableAmount}:${settlement.lateDays}`;
    const existing = await this.prisma.paymentTransaction.findUnique({ where: { idempotencyKey: key } });
    if (existing) {
      return {
        ...this.paymentResponse(existing.authority),
        payableAmount: Number(existing.amount),
        lateDays: settlement.lateDays,
        latePenaltyAmount: this.money(Number(existing.amount) - settlement.baseTotal),
        baseTotal: settlement.baseTotal,
      };
    }

    const payableAmount = settlement.payableAmount;
    const provider = this.config.get<string>('PAYMENT_PROVIDER', 'mock').toLowerCase();
    let authority = randomBytes(18).toString('hex');
    let paymentUrl: string | undefined;
    const gatewayDescription = settlement.latePenaltyAmount > 0
      ? `${invoice.description} | اصل: ${settlement.baseTotal} + جریمه تأخیر ${settlement.lateDays} روز: ${settlement.latePenaltyAmount}`
      : invoice.description;
    if (provider === 'zarinpal') {
      const merchantId = this.config.get<string>('ZARINPAL_MERCHANT_ID');
      const callbackUrl = this.config.get<string>('ZARINPAL_CALLBACK_URL');
      if (!merchantId || !callbackUrl) throw new BadRequestException('ZarinPal is not configured');
      const sandbox = this.config.get<string>('ZARINPAL_SANDBOX', 'true') === 'true';
      const baseUrl = sandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
      const response = await fetch(`${baseUrl}/pg/v4/payment/request.json`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          merchant_id: merchantId,
          amount: payableAmount,
          callback_url: callbackUrl,
          description: gatewayDescription,
        }),
      });
      const result: any = await response.json();
      if (!response.ok || result?.data?.code !== 100 || !result?.data?.authority) throw new BadRequestException('Unable to initialize ZarinPal payment');
      authority = result.data.authority;
      paymentUrl = `${baseUrl}/pg/StartPay/${authority}`;
    }
    const paymentParkId = invoice.parkId || invoice.factory?.parkId || null;
    await this.prisma.paymentTransaction.create({
      data: {
        authority,
        amount: payableAmount,
        invoiceId,
        parkId: paymentParkId,
        initiatedById: actor.id,
        idempotencyKey: key,
        provider: provider === 'zarinpal' ? 'ZARINPAL' : 'MOCK',
        providerStatus: {
          baseTotal: settlement.baseTotal,
          lateDays: settlement.lateDays,
          latePenaltyPerDay: settlement.latePenaltyPerDay,
          latePenaltyAmount: settlement.latePenaltyAmount,
          payableAmount,
          parkId: paymentParkId,
        },
      },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'PAYMENT_INITIATED',
      entity: 'Invoice',
      entityId: invoiceId,
      changes: {
        payableAmount,
        lateDays: settlement.lateDays,
        latePenaltyAmount: settlement.latePenaltyAmount,
      },
    });
    return {
      ...this.paymentResponse(authority, paymentUrl),
      payableAmount,
      lateDays: settlement.lateDays,
      latePenaltyAmount: settlement.latePenaltyAmount,
      baseTotal: settlement.baseTotal,
    };
  }

  async verifyPayment(authority: string, status: string) {
    const transaction = await this.prisma.paymentTransaction.findUnique({ where: { authority }, include: { invoice: true } });
    if (!transaction) throw new NotFoundException('Payment authority not found');
    if (transaction.status === PaymentStatus.VERIFIED) return { status: 'verified', invoiceId: transaction.invoiceId };
    if (status !== 'OK') {
      await this.prisma.paymentTransaction.update({ where: { id: transaction.id }, data: { status: PaymentStatus.FAILED, failureReason: 'Gateway cancelled payment' } });
      return { status: 'failed', invoiceId: transaction.invoiceId };
    }
    let referenceId = `MOCK-${Date.now()}`;
    let providerStatus: any = { mode: 'mock' };
    if (transaction.provider === 'ZARINPAL') {
      const merchantId = this.config.get<string>('ZARINPAL_MERCHANT_ID');
      if (!merchantId) throw new BadRequestException('ZarinPal is not configured');
      const sandbox = this.config.get<string>('ZARINPAL_SANDBOX', 'true') === 'true';
      const baseUrl = sandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
      const response = await fetch(`${baseUrl}/pg/v4/payment/verify.json`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ merchant_id: merchantId, amount: Number(transaction.amount), authority }) });
      const result: any = await response.json();
      if (!response.ok || ![100, 101].includes(result?.data?.code)) {
        await this.prisma.paymentTransaction.update({ where: { id: transaction.id }, data: { status: PaymentStatus.FAILED, failureReason: 'ZarinPal verification failed', providerStatus: result || {} } });
        return { status: 'failed', invoiceId: transaction.invoiceId };
      }
      referenceId = String(result.data.ref_id);
      providerStatus = result;
    }

    const invoice = transaction.invoice;
    const meta = (transaction.providerStatus && typeof transaction.providerStatus === 'object' && !Array.isArray(transaction.providerStatus))
      ? (transaction.providerStatus as Record<string, unknown>)
      : {};
    const baseFromMeta = Number(meta.baseTotal);
    const baseTotal = Number.isFinite(baseFromMeta) && baseFromMeta > 0 ? baseFromMeta : Number(invoice.totalAmount);
    const paidAmount = Number(transaction.amount);
    const latePenaltyAmount = Math.max(0, Math.round((paidAmount - baseTotal) * 100) / 100);
    const perDay = Number(invoice.latePenaltyPerDay || 0);
    const lateDaysFromMeta = Number(meta.lateDays);
    const lateDays = Number.isFinite(lateDaysFromMeta) && lateDaysFromMeta >= 0
      ? Math.floor(lateDaysFromMeta)
      : (perDay > 0 ? Math.round(latePenaltyAmount / perDay) : this.calendarDaysLate(invoice.penaltyStartsAt ?? invoice.dueDate));

    const invoiceUpdated = await this.prisma.$transaction(async (tx) => {
      // Money already left the payer: always record the verified transaction, but only an open
      // invoice may move to AWAITING_CONFIRMATION (never overwrite PAID / CANCELLED / INSTALLMENTS).
      const claimed = await tx.invoice.updateMany({
        where: { id: transaction.invoiceId, status: { in: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE] } },
        data: {
          // Docs: money verified at gateway, but PAID only after park-manager confirmation.
          status: InvoiceStatus.AWAITING_CONFIRMATION,
          paymentDate: new Date(),
          paymentMethod: transaction.provider,
          paymentRef: referenceId,
          paidById: transaction.initiatedById,
          lateDays,
          latePenaltyAmount,
        },
      });
      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: PaymentStatus.VERIFIED,
          referenceId,
          verifiedAt: new Date(),
          providerStatus: {
            ...meta,
            verify: providerStatus,
            frozenLateDays: lateDays,
            frozenLatePenaltyAmount: latePenaltyAmount,
            paidAmount,
            ...(claimed.count === 1 ? {} : { invoiceNotOpen: true, invoiceStatusAtVerify: invoice.status }),
          },
        },
      });
      return claimed.count === 1;
    });
    if (!invoiceUpdated) {
      this.logger.warn(`Payment ${transaction.id} verified but invoice ${transaction.invoiceId} was no longer open; needs manual review`);
      await this.audit.record({
        userId: transaction.initiatedById || undefined,
        action: 'PAYMENT_VERIFIED_INVOICE_NOT_OPEN',
        entity: 'Invoice',
        entityId: transaction.invoiceId,
        changes: { paidAmount, referenceId },
      });
      return { status: 'verified_needs_review', invoiceId: transaction.invoiceId, referenceId, paidAmount };
    }
    await this.audit.record({
      userId: transaction.initiatedById || undefined,
      action: 'PAYMENT_AWAITING_CONFIRMATION',
      entity: 'Invoice',
      entityId: transaction.invoiceId,
      changes: { paidAmount, lateDays, latePenaltyAmount },
    });
    return { status: 'awaiting_confirmation', invoiceId: transaction.invoiceId, referenceId, paidAmount, lateDays, latePenaltyAmount };
  }

  /** Park manager (or SA) confirms a gateway-verified payment → PAID. */
  async confirmInvoicePayment(actor: AuthenticatedUser, invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { factory: { select: { parkId: true, managerId: true, name: true } }, park: { select: { id: true, name: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== InvoiceStatus.AWAITING_CONFIRMATION) {
      throw new BadRequestException('Invoice is not awaiting payment confirmation');
    }
    if (actor.role === Role.SUPER_ADMIN) {
      // ok
    } else if (actor.role === Role.PARK_MANAGER) {
      const parkId = invoice.parkId || invoice.factory?.parkId;
      if (!parkId) throw new ForbiddenException('Invoice has no park scope');
      await this.assertParkScope(actor, parkId);
    } else {
      throw new ForbiddenException('Only park managers can confirm invoice payments');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.invoice.updateMany({
        where: { id: invoiceId, status: InvoiceStatus.AWAITING_CONFIRMATION },
        data: { status: InvoiceStatus.PAID },
      });
      if (claimed.count !== 1) throw new ConflictException('Invoice status changed; reload and try again');
      if (invoice.parentInvoiceId) await this.completeInstallmentParent(tx, invoice.parentInvoiceId);
      return tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    });
    await this.audit.record({
      userId: actor.id,
      action: 'INVOICE_PAYMENT_CONFIRMED',
      entity: 'Invoice',
      entityId: invoiceId,
    });
    const notifyUserId = invoice.targetType === InvoiceTarget.PARK
      ? null
      : invoice.factory?.managerId;
    if (notifyUserId) {
      await this.notifyUser(
        notifyUserId,
        'تایید پرداخت قبض',
        `پرداخت قبض «${invoice.invoiceNumber}» توسط مدیر شهرک تایید شد.`,
        'SUCCESS',
      );
    }
    return this.presentInvoice(updated);
  }

  async listRequests(user: AuthenticatedUser) {
    return this.prisma.request.findMany({
      where: { factoryId: { in: await this.factoryIds(user) } },
      include: {
        factory: true,
        creator: { select: { name: true, phoneNumber: true } },
        approver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRequest(actor: AuthenticatedUser, input: any) {
    for (const key of ['factoryId', 'type', 'title', 'description']) this.text(input[key], key);
    await this.assertFactoryAccess(actor, input.factoryId);
    const factory = await this.prisma.factory.findUnique({
      where: { id: input.factoryId },
      select: { id: true, name: true, parkId: true, managerId: true, status: true, suspendedReason: true },
    });
    if (!factory) throw new NotFoundException('Factory not found');
    this.assertFactoryNotSuspended(factory);
    const appointmentSlot = input.type === RequestType.APPOINTMENT && input.data?.appointmentDate
      ? new Date(`${input.data.appointmentDate}${input.data.appointmentTime ? `T${input.data.appointmentTime}` : 'T09:00:00'}`)
      : undefined;
    const request = await this.prisma.request.create({
      data: {
        factoryId: input.factoryId,
        type: input.type,
        title: input.title,
        description: input.description,
        data: input.data || {},
        attachments: input.attachments || [],
        priority: input.priority || 'MEDIUM',
        isToParkManager: Boolean(input.isToParkManager),
        creatorId: actor.id,
        ...(appointmentSlot ? { appointmentSlot } : {}),
      } as any,
    });
    await this.audit.record({ userId: actor.id, action: 'REQUEST_CREATED', entity: 'Request', entityId: request.id });
    await this.notifyRequestCreated(actor, request, factory);
    return request;
  }

  async requestAction(actor: AuthenticatedUser, id: string, action: 'approve' | 'reject', reason?: string) {
    const request = await this.prisma.request.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, phoneNumber: true } },
        factory: { select: { name: true } },
      },
    });
    if (!request) throw new NotFoundException('Request not found');
    await this.assertRequestActionAccess(actor, request);
    if (request.status !== RequestStatus.PENDING) throw new BadRequestException('Request is not pending');
    const data = action === 'approve' ? { status: RequestStatus.APPROVED, approverId: actor.id, approvedAt: new Date() } : { status: RequestStatus.REJECTED, approverId: actor.id, rejectedAt: new Date(), rejectionReason: reason || 'Rejected' };
    const updated = await this.prisma.request.update({
      where: { id },
      data,
      include: { approver: { select: { id: true, name: true } } },
    });
    await this.audit.record({ userId: actor.id, action: `REQUEST_${action.toUpperCase()}`, entity: 'Request', entityId: id });
    if (request.creator?.phoneNumber) {
      const approver = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { name: true } });
      const verb = action === 'approve' ? 'تایید' : 'رد';
      await this.safeSendSms(
        request.creator.phoneNumber,
        `کاربر گرامی ${request.creator.name}، درخواست «${request.title}» (${REQUEST_TYPE_FA[request.type] || request.type}) برای واحد ${request.factory?.name || ''} توسط ${approver?.name || 'تاییدکننده'} ${verb} شد.`,
      );
    }
    return updated;
  }

  async announcements(actor: AuthenticatedUser) {
    const now = new Date();
    const notExpired: Prisma.AnnouncementWhereInput = {
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };
    if (actor.role === Role.SUPER_ADMIN || actor.role === Role.GOVERNMENT_OFFICIAL) {
      return this.prisma.announcement.findMany({
        where: notExpired,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      });
    }

    const scopeOr = await this.announcementVisibilityOr(actor);
    return this.prisma.announcement.findMany({
      where: { AND: [notExpired, { OR: scopeOr }] },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAnnouncement(actor: AuthenticatedUser, input: CreateAnnouncementDto) {
    let parkId = input.parkId || null;
    let factoryId = input.factoryId || null;
    let isGlobal = Boolean(input.isGlobal);

    if (factoryId) {
      // Factory-unit announcements override park-wide / global flags.
      isGlobal = false;
      await this.assertFactoryAccess(actor, factoryId);
      const factory = await this.prisma.factory.findUnique({
        where: { id: factoryId },
        select: { parkId: true },
      });
      if (!factory) throw new NotFoundException('Factory not found');
      parkId = factory.parkId;
    } else if (actor.role === Role.PARK_MANAGER) {
      const managed = await this.managedParkIds(actor);
      if (!managed.length) throw new ForbiddenException('No managed park assigned');
      if (parkId) {
        if (!managed.includes(parkId)) throw new ForbiddenException('You do not have access to this park');
      } else if (managed.length === 1) {
        parkId = managed[0];
      } else {
        throw new BadRequestException('parkId is required for park managers with multiple parks');
      }
      isGlobal = false;
    } else if (isGlobal) {
      parkId = null;
      factoryId = null;
    } else if (parkId) {
      await this.assertParkScope(actor, parkId);
    } else if (actor.role === Role.SUPER_ADMIN) {
      throw new BadRequestException('Either isGlobal=true, parkId, or factoryId is required for announcements');
    }

    const item = await this.prisma.announcement.create({
      data: {
        title: input.title,
        content: input.content,
        isGlobal,
        isPinned: Boolean(input.isPinned),
        priority: Number(input.priority || 0),
        parkId,
        factoryId,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        createdById: actor.id,
      },
    });
    await this.audit.record({ userId: actor.id, action: 'ANNOUNCEMENT_CREATED', entity: 'Announcement', entityId: item.id });

    // Notify only the scoped audience — never the whole platform unless isGlobal.
    const recipients = await this.announcementRecipients(actor, parkId, factoryId, isGlobal);
    await Promise.all(recipients.map((userId) => this.notifyUser(userId, item.title, item.content.slice(0, 280), 'INFO')));
    return item;
  }

  async managedAnnouncements(actor: AuthenticatedUser) {
    const where = actor.role === Role.SUPER_ADMIN ? {} : { OR: [{ createdById: actor.id }, { parkId: { in: await this.managedParkIds(actor) } }] };
    return this.prisma.announcement.findMany({ where, orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }] });
  }

  async updateAnnouncement(actor: AuthenticatedUser, id: string, input: UpdateAnnouncementDto) {
    if (!Object.keys(input).length) throw new BadRequestException('At least one announcement field must be provided');
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');
    await this.assertAnnouncementAccess(actor, existing);
    const data: Prisma.AnnouncementUpdateInput = {};
    const changes: Record<string, Prisma.InputJsonValue> = {};
    for (const key of ['title', 'content', 'isGlobal', 'isPinned', 'priority'] as const) {
      if (input[key] !== undefined) { (data as Record<string, unknown>)[key] = input[key]; changes[key] = input[key] as Prisma.InputJsonValue; }
    }
    if (actor.role === Role.PARK_MANAGER) {
      data.isGlobal = false;
      changes.isGlobal = false;
    }
    if (input.expiresAt !== undefined) {
      data.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
      changes.expiresAt = input.expiresAt ?? null;
    }
    const item = await this.prisma.announcement.update({ where: { id }, data });
    await this.audit.record({ userId: actor.id, action: 'ANNOUNCEMENT_UPDATED', entity: 'Announcement', entityId: id, changes: changes as Prisma.InputJsonObject });
    return item;
  }

  async deleteAnnouncement(actor: AuthenticatedUser, id: string) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');
    await this.assertAnnouncementAccess(actor, existing);
    await this.prisma.announcement.delete({ where: { id } });
    await this.audit.record({ userId: actor.id, action: 'ANNOUNCEMENT_DELETED', entity: 'Announcement', entityId: id });
    return { id, deleted: true };
  }

  async publicAdvertisements(query: PublicAdvertisementQueryDto = {}) {
    const search = query.search?.trim();
    const where: Prisma.AdvertisementWhereInput = {
      status: AdvertisementStatus.APPROVED,
      ...(query.category ? { category: { is: { key: query.category } } } : {}),
      ...(buildSemanticContainsOr<Prisma.AdvertisementWhereInput>(
        ['title', 'content', 'province', 'city', 'address'],
        search,
      ) || {}),
    };
    const orderBy = query.view === 'fresh'
      ? [{ createdAt: 'desc' as const }, { id: 'asc' as const }]
      : [{ createdAt: 'desc' as const }, { id: 'asc' as const }];
    const records = await this.prisma.advertisement.findMany({
      where,
      select: ADVERTISEMENT_MODERATION_SELECT,
      orderBy,
    });
    return records.map((record) => this.safeAdvertisement(record));
  }

  async publicFeaturedAdvertisements() {
    const now = new Date();
    const records = await this.prisma.advertisement.findMany({
      where: {
        status: AdvertisementStatus.APPROVED,
        isFeatured: true,
        OR: [{ featuredUntil: null }, { featuredUntil: { gt: now } }],
      },
      select: ADVERTISEMENT_MODERATION_SELECT,
      orderBy: [{ featuredUntil: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      take: 20,
    });
    return records.map((record) => this.safeAdvertisement(record));
  }

  async publicAnnouncements() {
    const now = new Date();
    return this.prisma.announcement.findMany({
      where: {
        isGlobal: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ isPinned: 'desc' }, { priority: 'desc' }, { createdAt: 'desc' }],
      take: 12,
    });
  }

  async listAdvertisementCategories(includeInactive = false) {
    return this.prisma.advertisementCategoryDef.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ label: 'asc' }, { key: 'asc' }],
    });
  }

  async createAdvertisementCategory(actor: AuthenticatedUser, input: CreateAdvertisementCategoryDto) {
    if (actor.role !== Role.SUPER_ADMIN) throw new ForbiddenException('Only super admins can manage ad categories');
    const key = input.key.trim().toUpperCase();
    const created = await this.prisma.advertisementCategoryDef.create({
      data: { key, label: input.label.trim() },
    });
    await this.audit.record({ userId: actor.id, action: 'AD_CATEGORY_CREATED', entity: 'AdvertisementCategoryDef', entityId: created.id });
    return created;
  }

  async updateAdvertisementCategory(actor: AuthenticatedUser, id: string, input: UpdateAdvertisementCategoryDto) {
    if (actor.role !== Role.SUPER_ADMIN) throw new ForbiddenException('Only super admins can manage ad categories');
    const existing = await this.prisma.advertisementCategoryDef.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Advertisement category not found');
    const updated = await this.prisma.advertisementCategoryDef.update({
      where: { id },
      data: {
        ...(input.label !== undefined ? { label: input.label.trim() } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    await this.audit.record({ userId: actor.id, action: 'AD_CATEGORY_UPDATED', entity: 'AdvertisementCategoryDef', entityId: id });
    return updated;
  }

  async deleteAdvertisementCategory(actor: AuthenticatedUser, id: string) {
    if (actor.role !== Role.SUPER_ADMIN) throw new ForbiddenException('Only super admins can manage ad categories');
    const inUse = await this.prisma.advertisement.count({ where: { categoryId: id } });
    if (inUse > 0) throw new ConflictException('Category is in use by existing advertisements');
    await this.prisma.advertisementCategoryDef.delete({ where: { id } });
    await this.audit.record({ userId: actor.id, action: 'AD_CATEGORY_DELETED', entity: 'AdvertisementCategoryDef', entityId: id });
    return { id, deleted: true };
  }

  async listFavoriteAdvertisements(actor: AuthenticatedUser) {
    const favorites = await this.prisma.advertisementFavorite.findMany({
      where: { userId: actor.id },
      include: { advertisement: { select: ADVERTISEMENT_MODERATION_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    return favorites
      .map((row) => row.advertisement)
      .filter((ad) => ad.status === AdvertisementStatus.APPROVED)
      .map((record) => this.safeAdvertisement(record));
  }

  async addAdvertisementFavorite(actor: AuthenticatedUser, advertisementId: string) {
    const ad = await this.prisma.advertisement.findFirst({
      where: { id: advertisementId, status: AdvertisementStatus.APPROVED },
      select: { id: true },
    });
    if (!ad) throw new NotFoundException('Advertisement not found');
    await this.prisma.advertisementFavorite.upsert({
      where: { userId_advertisementId: { userId: actor.id, advertisementId } },
      create: { userId: actor.id, advertisementId },
      update: {},
    });
    return { advertisementId, favorited: true };
  }

  async removeAdvertisementFavorite(actor: AuthenticatedUser, advertisementId: string) {
    await this.prisma.advertisementFavorite.deleteMany({
      where: { userId: actor.id, advertisementId },
    });
    return { advertisementId, favorited: false };
  }

  async requestFeaturedAdvertisementPaymentStub(actor: AuthenticatedUser, id: string) {
    const ad = await this.prisma.advertisement.findFirst({
      where: { id, createdById: actor.id, status: AdvertisementStatus.APPROVED },
      select: { id: true, title: true },
    });
    if (!ad) throw new NotFoundException('Approved advertisement not found');
    const stubId = `FEAT-${randomBytes(4).toString('hex').toUpperCase()}`;
    await this.audit.record({
      userId: actor.id,
      action: 'AD_FEATURED_PAYMENT_STUB',
      entity: 'Advertisement',
      entityId: id,
      changes: { stubId, note: 'Payment gateway stub — awaiting manual confirmation' },
    });
    return {
      advertisementId: id,
      stubId,
      message: 'درخواست جایگاه ویژه ثبت شد. پس از پرداخت، مدیر شهرک می‌تواند آگهی را در اسلایدر قرار دهد.',
    };
  }

  async getAdvertisementFeaturedSettings() {
    const monthlyCap = await this.featuredAdvertisementMonthlyCap();
    return { monthlyCap };
  }

  async updateAdvertisementFeaturedSettings(actor: AuthenticatedUser, monthlyCap: number) {
    if (actor.role !== Role.SUPER_ADMIN) throw new ForbiddenException('Only super admins can change featured settings');
    await this.prisma.appSetting.upsert({
      where: { key: ManagementService.FEATURED_ADS_MONTHLY_CAP_KEY },
      create: { key: ManagementService.FEATURED_ADS_MONTHLY_CAP_KEY, value: { monthlyCap }, updatedById: actor.id },
      update: { value: { monthlyCap }, updatedById: actor.id },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'AD_FEATURED_SETTING_UPDATED',
      entity: 'AppSetting',
      entityId: ManagementService.FEATURED_ADS_MONTHLY_CAP_KEY,
      changes: { monthlyCap },
    });
    return this.getAdvertisementFeaturedSettings();
  }

  async createFeedback(actor: AuthenticatedUser, input: CreateFeedbackDto) {
    this.text(input.subject, 'subject');
    this.text(input.body, 'body');
    if (input.recipientParkId) {
      if (actor.role !== Role.SUPER_ADMIN) {
        const parkIds = await this.actorParkIds(actor);
        if (!parkIds.includes(input.recipientParkId)) {
          throw new ForbiddenException('You cannot send feedback to this park');
        }
      }
    }
    const item = await this.prisma.feedback.create({
      data: {
        subject: input.subject.trim(),
        body: input.body.trim(),
        recipientParkId: input.recipientParkId || null,
        senderId: actor.id,
      },
    });
    await this.audit.record({ userId: actor.id, action: 'FEEDBACK_CREATED', entity: 'Feedback', entityId: item.id });
    return item;
  }

  async advertisementCreationScope(actor: AuthenticatedUser) {
    const parks = await this.eligibleAdvertisementParks(actor);
    return {
      canCreate: parks.length > 0,
      requiresSelection: parks.length > 1,
      autoSelectedParkId: parks.length === 1 ? parks[0].id : null,
      parks,
    };
  }

  async createAdvertisement(actor: AuthenticatedUser, input: CreateAdvertisementDto) {
    for (const key of ['title', 'category', 'province', 'city', 'content'] as const) this.text(input[key], key);
    return this.auditedTransaction(
      actor,
      { action: 'ADVERTISEMENT_CREATED', entity: 'Advertisement', entityId: (created: { id: string }) => created.id },
      async (tx) => {
        const category = await tx.advertisementCategoryDef.findUnique({ where: { key: input.category.trim() } });
        if (!category?.isActive) throw new BadRequestException('Advertisement category is invalid or inactive');
        const parkId = await this.resolveAdvertisementParkId(actor, input.parkId, tx);
        const created = await tx.advertisement.create({
          data: {
            title: input.title.trim(),
            categoryId: category.id,
            province: input.province.trim(),
            city: input.city.trim(),
            address: input.address?.trim(),
            content: input.content.trim(),
            price: input.price,
            contactInfo: this.safeAdvertisementContact(input.contactInfo as Prisma.JsonValue),
            images: input.images ?? [],
            parkId,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
            createdById: actor.id,
          },
          select: ADVERTISEMENT_MODERATION_SELECT,
        });
        return this.safeAdvertisement(created);
      },
    );
  }

  async myAdvertisements(actor: AuthenticatedUser) {
    const records = await this.prisma.advertisement.findMany({
      where: { createdById: actor.id },
      select: ADVERTISEMENT_MODERATION_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return records.map((record) => this.safeAdvertisement(record));
  }

  async myAdvertisementDetail(actor: AuthenticatedUser, id: string) {
    const item = await this.prisma.advertisement.findFirst({
      where: { id, createdById: actor.id },
      select: ADVERTISEMENT_MODERATION_SELECT,
    });
    if (!item) throw new NotFoundException('Advertisement not found');
    return this.safeAdvertisement(item);
  }

  async updateMyAdvertisement(actor: AuthenticatedUser, id: string, input: UpdateAdvertisementDto) {
    for (const key of ['title', 'category', 'province', 'city', 'content'] as const) this.text(input[key], key);
    return this.auditedTransaction(
      actor,
      { action: 'ADVERTISEMENT_UPDATED', entity: 'Advertisement', entityId: id },
      async (tx) => {
        const existing = await tx.advertisement.findFirst({
          where: { id, createdById: actor.id },
          select: { id: true, status: true },
        });
        if (!existing) throw new NotFoundException('Advertisement not found');
        if (existing.status !== AdvertisementStatus.PENDING) {
          throw new ConflictException('Only pending advertisements can be edited');
        }
        const category = await tx.advertisementCategoryDef.findUnique({ where: { key: input.category.trim() } });
        if (!category?.isActive) throw new BadRequestException('Advertisement category is invalid or inactive');
        const updated = await tx.advertisement.update({
          where: { id },
          data: {
            title: input.title.trim(),
            categoryId: category.id,
            province: input.province.trim(),
            city: input.city.trim(),
            address: input.address?.trim() || null,
            content: input.content.trim(),
            price: input.price ?? null,
            contactInfo: this.safeAdvertisementContact(input.contactInfo as unknown as Prisma.JsonValue),
            images: input.images ?? [],
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          },
          select: ADVERTISEMENT_MODERATION_SELECT,
        });
        return this.safeAdvertisement(updated);
      },
    );
  }

  async deleteMyAdvertisement(actor: AuthenticatedUser, id: string) {
    return this.auditedTransaction(
      actor,
      { action: 'ADVERTISEMENT_DELETED', entity: 'Advertisement', entityId: id },
      async (tx) => {
        const existing = await tx.advertisement.findFirst({
          where: { id, createdById: actor.id },
          select: { id: true, status: true },
        });
        if (!existing) throw new NotFoundException('Advertisement not found');
        if (existing.status !== AdvertisementStatus.PENDING) {
          throw new ConflictException('Only pending advertisements can be deleted');
        }
        await tx.advertisement.delete({ where: { id } });
        return { id, deleted: true };
      },
    );
  }

  async approveAdvertisement(
    actor: AuthenticatedUser,
    id: string,
    approved: boolean,
    rejectionReason?: string,
    promoteFeatured?: boolean,
  ) {
    if (!approved && !rejectionReason?.trim()) throw new BadRequestException('A rejection reason is required');
    const finalStatus = approved ? AdvertisementStatus.APPROVED : AdvertisementStatus.REJECTED;
    return this.auditedTransaction(
      actor,
      {
        action: approved ? 'ADVERTISEMENT_APPROVED' : 'ADVERTISEMENT_REJECTED',
        entity: 'Advertisement',
        entityId: id,
        changes: { from: AdvertisementStatus.PENDING, to: finalStatus },
      },
      async (tx) => {
        const reviewParks = actor.role === Role.SUPER_ADMIN ? [] : await this.advertisementReviewParks(actor, tx);
        const parkIds = reviewParks.map(({ id: parkId }) => parkId);
        const existing = actor.role === Role.SUPER_ADMIN
          ? await tx.advertisement.findUnique({ where: { id }, select: { id: true, parkId: true, status: true } })
          : await tx.advertisement.findFirst({ where: { id, parkId: { in: parkIds } }, select: { id: true, parkId: true, status: true } });
        if (!existing) {
          if (actor.role === Role.SUPER_ADMIN) throw new NotFoundException('Advertisement not found');
          throw new ForbiddenException('You do not have access to this advertisement');
        }
        if (!existing.parkId) throw new ForbiddenException('Advertisement does not have a valid moderation scope');
        if (existing.status !== AdvertisementStatus.PENDING) throw new ConflictException('Advertisement decision was already recorded');
        const where: Prisma.AdvertisementWhereInput = { id, status: AdvertisementStatus.PENDING, parkId: { not: null } };
        if (actor.role !== Role.SUPER_ADMIN) where.parkId = { in: parkIds };
        const transition = await tx.advertisement.updateMany({
          where,
          data: {
            status: finalStatus,
            isApproved: approved,
            rejectionReason: approved ? null : rejectionReason?.trim(),
            moderatedById: actor.id,
            moderatedAt: new Date(),
          },
        });
        if (transition.count !== 1) throw new ConflictException('Advertisement decision was already recorded');
        if (approved && promoteFeatured) {
          await this.applyFeaturedPromotion(tx, id);
        }
        const item = await tx.advertisement.findUnique({ where: { id }, select: ADVERTISEMENT_MODERATION_SELECT });
        if (!item) throw new NotFoundException('Advertisement not found');
        return this.safeAdvertisement(item);
      },
    );
  }

  async managedAdvertisementPage(actor: AuthenticatedUser, query: AdvertisementAdminQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 12));
    const view = query.view ?? 'PENDING';
    if (view === 'PENDING' && query.status && query.status !== AdvertisementStatus.PENDING) {
      throw new BadRequestException('Pending view only accepts PENDING status');
    }
    if (view === 'HISTORY' && query.status === AdvertisementStatus.PENDING) {
      throw new BadRequestException('History view does not accept PENDING status');
    }

    return this.prisma.$transaction(async (tx) => {
      const availableParks = await this.advertisementReviewParks(actor, tx);
      const parkIds = availableParks.map(({ id }) => id);
      if (query.parkId && actor.role !== Role.SUPER_ADMIN && !parkIds.includes(query.parkId)) {
        throw new ForbiddenException('You do not have access to this advertisement scope');
      }
      const search = query.search?.trim();
      const where: Prisma.AdvertisementWhereInput = {
        status: view === 'PENDING'
          ? AdvertisementStatus.PENDING
          : query.status ?? { not: AdvertisementStatus.PENDING },
        ...(actor.role === Role.SUPER_ADMIN ? {} : { parkId: { in: parkIds } }),
        ...(query.parkId ? { parkId: query.parkId } : {}),
        ...(query.category ? { category: { is: { key: query.category } } } : {}),
        ...(buildSemanticContainsOr<Prisma.AdvertisementWhereInput>(
          ['title', 'content', 'province', 'city'],
          search,
        ) || {}),
      };
      const [records, total] = await Promise.all([
        tx.advertisement.findMany({
          where,
          select: ADVERTISEMENT_MODERATION_SELECT,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        tx.advertisement.count({ where }),
      ]);
      return {
        items: records.map((record) => this.safeAdvertisement(record)),
        total,
        page,
        pageSize,
        availableParks,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async managedAdvertisementDetail(actor: AuthenticatedUser, id: string) {
    const reviewParks = actor.role === Role.SUPER_ADMIN ? [] : await this.advertisementReviewParks(actor);
    const item = await this.prisma.advertisement.findFirst({
      where: {
        id,
        ...(actor.role === Role.SUPER_ADMIN ? {} : { parkId: { in: reviewParks.map(({ id: parkId }) => parkId) } }),
      },
      select: ADVERTISEMENT_MODERATION_SELECT,
    });
    if (!item) {
      if (actor.role === Role.SUPER_ADMIN) throw new NotFoundException('Advertisement not found');
      throw new ForbiddenException('You do not have access to this advertisement');
    }
    return this.safeAdvertisement(item);
  }

  async managedAdvertisements(actor: AuthenticatedUser, statusFilter: 'PENDING' | 'HISTORY') {
    const reviewParks = actor.role === Role.SUPER_ADMIN ? [] : await this.advertisementReviewParks(actor);
    const where: Prisma.AdvertisementWhereInput = {
      status: statusFilter === 'PENDING' ? AdvertisementStatus.PENDING : { not: AdvertisementStatus.PENDING },
      ...(actor.role === Role.SUPER_ADMIN ? {} : { parkId: { in: reviewParks.map(({ id }) => id) } }),
    };
    const records = await this.prisma.advertisement.findMany({
      where,
      select: ADVERTISEMENT_MODERATION_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return records.map((record) => this.safeAdvertisement(record));
  }

  async emergencies(actor: AuthenticatedUser) {
    const where = await this.emergencyScopeWhere(actor);
    const items = await this.prisma.emergencyAlert.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true, phoneNumber: true, role: true } },
        resolvedBy: { select: { id: true, name: true, role: true } },
        park: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    return this.withEmergencyPermissions(actor, items);
  }

  async activeEmergencies(actor: AuthenticatedUser) {
    const scope = await this.emergencyScopeWhere(actor);
    const items = await this.prisma.emergencyAlert.findMany({
      where: {
        AND: [
          scope,
          { status: { in: [EmergencyStatus.OPEN, EmergencyStatus.ACKNOWLEDGED] } },
        ],
      },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        park: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });
    return this.withEmergencyPermissions(actor, items);
  }

  private async withEmergencyPermissions<T extends { createdById: string; parkId: string | null; status: EmergencyStatus }>(actor: AuthenticatedUser, items: T[]) {
    const managedParks = actor.role === Role.PARK_MANAGER && items.length ? await this.managedParkIds(actor) : [];
    return items.map((item) => ({
      ...item,
      canResolve: item.status !== EmergencyStatus.RESOLVED && this.canResolveEmergency(actor, item, managedParks),
    }));
  }

  /** Only the reporter, a manager of the alert's park, or a super admin may stop an alarm for everyone. */
  private canResolveEmergency(actor: AuthenticatedUser, alert: { createdById: string; parkId: string | null }, managedParkIds: string[]): boolean {
    if (actor.role === Role.SUPER_ADMIN) return true;
    if (alert.createdById === actor.id) return true;
    return actor.role === Role.PARK_MANAGER && Boolean(alert.parkId && managedParkIds.includes(alert.parkId));
  }

  async createEmergency(actor: AuthenticatedUser, input: CreateEmergencyDto) {
    this.text(input.title, 'title');
    this.text(input.description, 'description');
    const title = input.title.trim();
    const description = input.description.trim();
    const parkId = await this.resolveEmergencyParkId(actor, input.parkId);
    const severity = input.severity || 'HIGH';

    const item = await this.prisma.emergencyAlert.create({
      data: {
        title,
        description,
        severity,
        location: input.location as Prisma.InputJsonValue | undefined,
        parkId,
        createdById: actor.id,
      },
      include: {
        park: { select: { id: true, name: true, code: true, guardPhone: true } },
        createdBy: { select: { id: true, name: true, role: true, phoneNumber: true } },
      },
    });

    await this.audit.record({
      userId: actor.id,
      action: 'EMERGENCY_CREATED',
      entity: 'EmergencyAlert',
      entityId: item.id,
      changes: { parkId, severity, title } as Prisma.InputJsonObject,
    });

    const recipients = await this.emergencyRecipients(parkId);
    const notifyTitle = `🚨 هشدار اضطراری: ${title}`;
    const notifyBody = description.slice(0, 500);
    if (recipients.userIds.length) {
      await this.prisma.notification.createMany({
        data: recipients.userIds.map((userId) => ({
          userId,
          title: notifyTitle,
          body: notifyBody,
          type: 'EMERGENCY' as const,
        })),
      });
    }

    const managerPhone = item.createdBy?.phoneNumber || actor.phoneNumber;
    const location = input.location as { latitude?: number; longitude?: number; address?: string } | undefined;
    const locationPart = location?.latitude != null && location?.longitude != null
      ? `موقعیت: ${location.latitude},${location.longitude}`
      : (location?.address?.trim() || '');
    const smsMessage = `MEKSS اضطراری [${item.park?.name || 'شهرک'}]: ${title}`;
    await Promise.all(recipients.phones.map((phone) => this.safeSendSms(phone, smsMessage)));
    if (item.park?.guardPhone) {
      const guardDetail = [
        `MEKSS امداد/حریق [${item.park.name}]: ${title}`,
        description.slice(0, 240),
        managerPhone ? `تماس مدیر واحد: ${managerPhone}` : '',
        locationPart,
      ].filter(Boolean).join(' · ');
      await this.safeSendSms(item.park.guardPhone, guardDetail);
    }

    return item;
  }

  async emergencyAction(actor: AuthenticatedUser, id: string, action: 'acknowledge' | 'resolve', note?: string | null) {
    const existing = await this.prisma.emergencyAlert.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Emergency alert not found');
    await this.assertEmergencyAccess(actor, existing);

    if (action === 'resolve') {
      const managedParks = actor.role === Role.PARK_MANAGER ? await this.managedParkIds(actor) : [];
      if (!this.canResolveEmergency(actor, existing, managedParks)) {
        throw new ForbiddenException('Only the reporter or the manager of this park can stop the alarm');
      }
    } else if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.PARK_MANAGER && actor.role !== Role.SECURITY_GUARD) {
      throw new ForbiddenException('You cannot acknowledge emergency alerts');
    }
    if (existing.status === EmergencyStatus.RESOLVED) throw new ConflictException('Emergency alert is already resolved');

    // Guarded on status so a late acknowledge can never re-open (and re-sound) a resolved alarm.
    const changed = await this.prisma.emergencyAlert.updateMany({
      where: { id, status: { not: EmergencyStatus.RESOLVED } },
      data: action === 'resolve'
        ? { status: EmergencyStatus.RESOLVED, resolvedAt: new Date(), resolvedById: actor.id, resolutionNote: note?.trim() || null }
        : { status: EmergencyStatus.ACKNOWLEDGED },
    });
    if (changed.count !== 1) throw new ConflictException('Emergency alert is already resolved');
    const item = await this.prisma.emergencyAlert.findUniqueOrThrow({
      where: { id },
      include: {
        park: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });

    await this.audit.record({
      userId: actor.id,
      action: `EMERGENCY_${action.toUpperCase()}`,
      entity: 'EmergencyAlert',
      entityId: id,
    });

    if (action === 'resolve' && existing.parkId) {
      const recipients = await this.emergencyRecipients(existing.parkId);
      const clearTitle = `✅ پایان وضعیت اضطراری: ${existing.title}`;
      const clearBody = 'وضعیت اضطراری رفع شد. به فعالیت عادی بازگردید.';
      if (recipients.userIds.length) {
        await this.prisma.notification.createMany({
          data: recipients.userIds.map((userId) => ({
            userId,
            title: clearTitle,
            body: clearBody,
            type: 'SUCCESS' as const,
          })),
        });
      }
    }

    return item;
  }

  async dashboard(user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const isSuperAdmin = user.role === Role.SUPER_ADMIN;
      const isParkManager = user.role === Role.PARK_MANAGER;
      const hasGlobalFactoryScope = isSuperAdmin || user.role === Role.GOVERNMENT_OFFICIAL;
      const factoryScope: Prisma.FactoryWhereInput = isParkManager
        ? { park: { is: { managers: { some: { id: user.id } } } } }
        : user.role === Role.FACTORY_OWNER
          ? (user.activeFactoryId ? { managerId: user.id, id: user.activeFactoryId } : { managerId: user.id })
          : user.role === Role.SECURITY_GUARD
            ? { park: { is: { securityGuards: { some: { userId: user.id, isActive: true } } } } }
            : {};
      const factoryWhere = hasGlobalFactoryScope ? {} : { factory: { is: factoryScope } };
      const advertisementWhere: Prisma.AdvertisementWhereInput = {
        status: AdvertisementStatus.PENDING,
        ...(isParkManager ? { park: { is: { managers: { some: { id: user.id } } } } } : {}),
      };
      const canReviewPendingWork = isSuperAdmin || isParkManager;
      const recentLimit = 8;
      const managedParkCount = isParkManager
        ? await tx.industrialPark.count({ where: { managers: { some: { id: user.id } } } })
        : 0;
      const emergencyParkIds = hasGlobalFactoryScope ? null : await this.actorParkIds(user);
      const emergencyWhere: Prisma.EmergencyAlertWhereInput = {
        status: { not: EmergencyStatus.RESOLVED },
        ...(emergencyParkIds ? { parkId: { in: emergencyParkIds } } : {}),
      };

      const unpaidStatuses = { in: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE, InvoiceStatus.AWAITING_CONFIRMATION] as InvoiceStatus[] };
      const factoryUnpaidWhere: Prisma.InvoiceWhereInput = {
        targetType: InvoiceTarget.FACTORY,
        ...factoryWhere,
        status: unpaidStatuses,
      };
      // Personal debt banner: what THIS actor owes (park invoices for park managers; factory invoices for owners).
      const personalUnpaidWhere: Prisma.InvoiceWhereInput = isParkManager
        ? {
          targetType: InvoiceTarget.PARK,
          parkId: { in: await this.managedParkIds(user, tx) },
          status: unpaidStatuses,
        }
        : user.role === Role.FACTORY_OWNER
          ? factoryUnpaidWhere
          : isSuperAdmin
            ? { id: { in: [] } } // SA is never personally billed via this banner
            : factoryUnpaidWhere;

      const [
        factories,
        passes,
        invoices,
        requests,
        emergencies,
        pendingGatePasses,
        pendingRequests,
        pendingAdvertisements,
        recentRequests,
        recentGatePasses,
        recentAdvertisements,
        unpaidInvoiceCount,
        unpaidInvoiceAggregate,
        unitsUnpaidInvoiceCount,
        unitsUnpaidInvoiceAggregate,
        unitsWithDebt,
      ] = await Promise.all([
        tx.factory.count({ where: factoryScope }),
        tx.gatePass.count({ where: factoryWhere }),
        tx.invoice.count({ where: { targetType: InvoiceTarget.FACTORY, ...factoryWhere } }),
        tx.request.count({ where: factoryWhere }),
        tx.emergencyAlert.count({ where: emergencyWhere }),
        tx.gatePass.count({
          where: {
            ...factoryWhere,
            // Each role counts the stage waiting on it: guards → approved passes, reviewers → new ones.
            status: user.role === Role.SECURITY_GUARD
              ? GatePassStatus.APPROVED
              : canReviewPendingWork
                ? GatePassStatus.PENDING
                : { in: [GatePassStatus.PENDING, GatePassStatus.APPROVED] },
          },
        }),
        tx.request.count({ where: { ...factoryWhere, status: RequestStatus.PENDING } }),
        canReviewPendingWork
          ? tx.advertisement.count({ where: advertisementWhere })
          : Promise.resolve(0),
        canReviewPendingWork
          ? tx.request.findMany({
            where: { ...factoryWhere, status: RequestStatus.PENDING },
            select: { id: true, title: true, status: true, priority: true, createdAt: true },
            orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
            take: recentLimit,
          })
          : Promise.resolve([]),
        canReviewPendingWork
          ? tx.gatePass.findMany({
            where: { ...factoryWhere, status: GatePassStatus.PENDING },
            select: { id: true, status: true, createdAt: true, factory: { select: { name: true } } },
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            take: recentLimit,
          })
          : Promise.resolve([]),
        canReviewPendingWork
          ? tx.advertisement.findMany({
            where: advertisementWhere,
            select: { id: true, title: true, status: true, createdAt: true },
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            take: recentLimit,
          })
          : Promise.resolve([]),
        tx.invoice.count({ where: personalUnpaidWhere }),
        tx.invoice.aggregate({ where: personalUnpaidWhere, _sum: { totalAmount: true } }),
        // Collection view: unpaid factory-unit invoices under this park manager / SA.
        (isParkManager || isSuperAdmin || user.role === Role.GOVERNMENT_OFFICIAL)
          ? tx.invoice.count({ where: factoryUnpaidWhere })
          : Promise.resolve(0),
        (isParkManager || isSuperAdmin || user.role === Role.GOVERNMENT_OFFICIAL)
          ? tx.invoice.aggregate({ where: factoryUnpaidWhere, _sum: { totalAmount: true } })
          : Promise.resolve({ _sum: { totalAmount: null } }),
        (isParkManager || isSuperAdmin || user.role === Role.GOVERNMENT_OFFICIAL)
          ? tx.invoice.findMany({
            where: factoryUnpaidWhere,
            select: { factoryId: true },
            distinct: ['factoryId'],
          })
          : Promise.resolve([]),
      ]);

      const priorityWeight: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      const sortableItems = [
        ...recentRequests.map((item) => ({
          kind: 'REQUEST' as const,
          id: item.id,
          status: item.status,
          createdAt: item.createdAt.toISOString(),
          title: item.title,
          priority: item.priority,
          capability: 'approve_requests',
          rank: priorityWeight[item.priority] ?? 0,
        })),
        ...recentGatePasses.map((item) => ({
          kind: 'GATE_PASS' as const,
          id: item.id,
          status: item.status,
          createdAt: item.createdAt.toISOString(),
          title: item.factory.name,
          capability: 'approve_gate_passes',
          rank: priorityWeight.MEDIUM,
        })),
        ...recentAdvertisements.map((item) => ({
          kind: 'ADVERTISEMENT' as const,
          id: item.id,
          status: item.status,
          createdAt: item.createdAt.toISOString(),
          title: item.title,
          capability: isSuperAdmin ? 'manage_advertisements' : 'moderate_advertisements',
          rank: priorityWeight.MEDIUM,
        })),
      ];
      const recentPriorityItems = sortableItems
        .sort((left, right) => right.rank - left.rank
          || right.createdAt.localeCompare(left.createdAt)
          || left.kind.localeCompare(right.kind)
          || left.id.localeCompare(right.id))
        .slice(0, recentLimit)
        .map(({ rank: _rank, ...item }) => item);

      let capabilities = this.dashboardCapabilities(user.role);
      if (isSuperAdmin) {
        capabilities = Array.from(new Set([...capabilities, 'manage_factories', 'approve_gate_passes', 'approve_requests']));
      } else if (isParkManager && managedParkCount === 0) {
        const tenantMutationCapabilities = new Set([
          'manage_factories',
          'approve_gate_passes',
          'approve_requests',
          'manage_announcements',
          'moderate_advertisements',
          'send_messages',
        ]);
        capabilities = capabilities.filter((capability) => !tenantMutationCapabilities.has(capability));
      }

      const activePark = await this.resolveDashboardActivePark(user, tx);

      const personalUnpaidRows = unpaidInvoiceCount > 0 && (isParkManager || user.role === Role.FACTORY_OWNER)
        ? await tx.invoice.findMany({
          where: personalUnpaidWhere,
          select: {
            id: true,
            invoiceNumber: true,
            description: true,
            amount: true,
            taxAmount: true,
            totalAmount: true,
            discountAmount: true,
            latePenaltyPerDay: true,
            lateDays: true,
            latePenaltyAmount: true,
            dueDate: true,
            penaltyStartsAt: true,
            status: true,
            installmentNo: true,
            factory: { select: { id: true, name: true } },
            park: { select: { id: true, name: true } },
          },
          orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
          take: 500,
        })
        : [];
      const today = new Date();
      const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
      const unpaidInvoices = personalUnpaidRows.map((invoice) => {
        const settlement = this.computeInvoiceSettlement(invoice);
        const due = invoice.dueDate;
        const daysLeft = Math.round((Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()) - todayUtc) / 86_400_000);
        return {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          description: invoice.description,
          installmentNo: invoice.installmentNo,
          factoryName: invoice.factory?.name || null,
          parkName: invoice.park?.name || null,
          dueDate: due.toISOString(),
          daysLeft,
          lateDays: settlement.lateDays,
          latePenaltyAmount: settlement.latePenaltyAmount,
          payableAmount: settlement.payableAmount,
          status: settlement.status,
        };
      });
      const suspendedFactories = user.role === Role.FACTORY_OWNER
        ? await tx.factory.findMany({
          where: { ...factoryScope, status: FactoryStatus.SUSPENDED },
          select: { id: true, name: true, suspendedReason: true, suspendedAt: true },
        })
        : [];

      return {
        activePark,
        factories,
        gatePasses: passes,
        invoices,
        requests,
        openEmergencies: emergencies,
        // Personal debt (park bills for park managers; unit bills for factory owners).
        unpaidInvoiceCount,
        unpaidInvoiceTotal: Number(unpaidInvoiceAggregate._sum.totalAmount ?? 0),
        unpaidPayableTotal: unpaidInvoices.length
          ? this.money(unpaidInvoices.reduce((sum, invoice) => sum + invoice.payableAmount, 0))
          : Number(unpaidInvoiceAggregate._sum.totalAmount ?? 0),
        unpaidInvoices: unpaidInvoices.slice(0, 5),
        suspendedFactories,
        // Aggregate receivables from industrial units (park manager / SA collection view).
        unitsUnpaidInvoiceCount: Number(unitsUnpaidInvoiceCount || 0),
        unitsUnpaidInvoiceTotal: Number(unitsUnpaidInvoiceAggregate._sum.totalAmount ?? 0),
        unitsWithDebtCount: Array.isArray(unitsWithDebt)
          ? unitsWithDebt.filter((row) => row.factoryId).length
          : 0,
        pendingWork: { gatePasses: pendingGatePasses, requests: pendingRequests, advertisements: pendingAdvertisements },
        capabilities,
        recentPriorityItems,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  private async eligibleAdvertisementParks(actor: AuthenticatedUser, db: AdvertisementScopeDatabase = this.prisma): Promise<AdvertisementParkSummary[]> {
    let where: Prisma.IndustrialParkWhereInput;
    if (actor.role === Role.SUPER_ADMIN) {
      where = { status: ParkStatus.ACTIVE };
    } else if (actor.role === Role.PARK_MANAGER) {
      where = { status: ParkStatus.ACTIVE, managers: { some: { id: actor.id } } };
    } else if (actor.role === Role.FACTORY_OWNER) {
      where = { status: ParkStatus.ACTIVE, factories: { some: { managerId: actor.id, status: { not: FactoryStatus.SUSPENDED } } } };
    } else {
      throw new ForbiddenException('You do not have access to advertisement creation');
    }
    return db.industrialPark.findMany({
      where,
      select: { id: true, code: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  private async advertisementReviewParks(actor: AuthenticatedUser, db: AdvertisementScopeDatabase = this.prisma): Promise<AdvertisementParkSummary[]> {
    if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.PARK_MANAGER) {
      throw new ForbiddenException('You do not have access to advertisement moderation');
    }
    return db.industrialPark.findMany({
      where: actor.role === Role.SUPER_ADMIN ? {} : { managers: { some: { id: actor.id } } },
      select: { id: true, code: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  private async resolveAdvertisementParkId(actor: AuthenticatedUser, requestedParkId: string | undefined, tx: Prisma.TransactionClient): Promise<string> {
    const parks = await this.eligibleAdvertisementParks(actor, tx);
    if (!parks.length) throw new ForbiddenException('No eligible industrial park is available for advertisement creation');
    if (requestedParkId) {
      if (!parks.some(({ id }) => id === requestedParkId)) {
        throw new ForbiddenException('You do not have access to the requested advertisement scope');
      }
      return requestedParkId;
    }
    if (parks.length !== 1) throw new BadRequestException('parkId is required when multiple advertisement scopes are available');
    return parks[0].id;
  }

  private presentBanner<T extends { desktopImageId: string; mobileImageId: string }>(banner: T) {
    return {
      ...banner,
      desktopImageUrl: `/api/v1/files/${banner.desktopImageId}/content`,
      mobileImageUrl: `/api/v1/files/${banner.mobileImageId}/content`,
    };
  }

  private async visibleBannerWhere(actor: AuthenticatedUser): Promise<Prisma.DashboardBannerWhereInput> {
    const now = new Date();
    const parkIds = actor.role === Role.SUPER_ADMIN || actor.role === Role.GOVERNMENT_OFFICIAL
      ? null
      : await this.actorParkIds(actor);
    return {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ...(parkIds === null ? [] : [{ OR: [{ parkId: null }, { parkId: { in: parkIds } }] }]),
      ],
    };
  }

  async activeBanners(actor: AuthenticatedUser) {
    const items = await this.prisma.dashboardBanner.findMany({
      where: await this.visibleBannerWhere(actor),
      select: { id: true, title: true, desktopImageId: true, mobileImageId: true, linkUrl: true, openInNewTab: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 20,
    });
    return items.map((item) => this.presentBanner(item));
  }

  async managedBanners() {
    const items = await this.prisma.dashboardBanner.findMany({
      include: {
        park: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return items.map((item) => this.presentBanner(item));
  }

  private async validateBannerInput(input: {
    desktopImageId?: string;
    mobileImageId?: string;
    startsAt?: string | null;
    endsAt?: string | null;
    parkId?: string | null;
  }, current?: { startsAt: Date | null; endsAt: Date | null }) {
    const imageIds = [input.desktopImageId, input.mobileImageId].filter((value): value is string => Boolean(value));
    if (imageIds.length) {
      const assets = await this.prisma.mediaAsset.findMany({
        where: { id: { in: imageIds }, domain: 'banner' },
        select: { id: true },
      });
      const found = new Set(assets.map((asset) => asset.id));
      if (imageIds.some((id) => !found.has(id))) throw new BadRequestException('تصویر بنر معتبر نیست؛ تصویر را دوباره بارگذاری کنید');
    }
    if (input.parkId) {
      const park = await this.prisma.industrialPark.findUnique({ where: { id: input.parkId }, select: { id: true } });
      if (!park) throw new NotFoundException('Park not found');
    }
    const startsAt = input.startsAt !== undefined ? (input.startsAt ? new Date(input.startsAt) : null) : current?.startsAt ?? null;
    const endsAt = input.endsAt !== undefined ? (input.endsAt ? new Date(input.endsAt) : null) : current?.endsAt ?? null;
    if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('تاریخ پایان نمایش باید بعد از تاریخ شروع باشد');
    }
    return { startsAt, endsAt };
  }

  async createBanner(actor: AuthenticatedUser, input: CreateBannerDto) {
    const { startsAt, endsAt } = await this.validateBannerInput(input);
    const created = await this.prisma.dashboardBanner.create({
      data: {
        title: input.title.trim(),
        desktopImageId: input.desktopImageId,
        mobileImageId: input.mobileImageId,
        linkUrl: input.linkUrl || null,
        openInNewTab: input.openInNewTab ?? true,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
        startsAt,
        endsAt,
        parkId: input.parkId || null,
        createdById: actor.id,
      },
      include: { park: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
    });
    await this.audit.record({ userId: actor.id, action: 'BANNER_CREATED', entity: 'DashboardBanner', entityId: created.id });
    return this.presentBanner(created);
  }

  async updateBanner(actor: AuthenticatedUser, id: string, input: UpdateBannerDto) {
    const existing = await this.prisma.dashboardBanner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Banner not found');
    if (!Object.keys(input || {}).length) throw new BadRequestException('At least one banner field is required');
    const { startsAt, endsAt } = await this.validateBannerInput(input, existing);
    const updated = await this.prisma.dashboardBanner.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.desktopImageId !== undefined ? { desktopImageId: input.desktopImageId } : {}),
        ...(input.mobileImageId !== undefined ? { mobileImageId: input.mobileImageId } : {}),
        ...(input.linkUrl !== undefined ? { linkUrl: input.linkUrl || null } : {}),
        ...(input.openInNewTab !== undefined ? { openInNewTab: input.openInNewTab } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.parkId !== undefined ? { parkId: input.parkId || null } : {}),
        startsAt,
        endsAt,
      },
      include: { park: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
    });
    await this.audit.record({ userId: actor.id, action: 'BANNER_UPDATED', entity: 'DashboardBanner', entityId: id, changes: input as Prisma.InputJsonObject });
    return this.presentBanner(updated);
  }

  async deleteBanner(actor: AuthenticatedUser, id: string) {
    const existing = await this.prisma.dashboardBanner.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Banner not found');
    await this.prisma.dashboardBanner.delete({ where: { id } });
    await this.audit.record({ userId: actor.id, action: 'BANNER_DELETED', entity: 'DashboardBanner', entityId: id });
    return { message: 'بنر حذف شد' };
  }

  async recordBannerClick(actor: AuthenticatedUser, id: string) {
    await this.prisma.dashboardBanner.updateMany({
      where: { id, ...(await this.visibleBannerWhere(actor)) },
      data: { clickCount: { increment: 1 } },
    });
    return { ok: true };
  }

  private safeAdvertisementContact(value: Prisma.JsonValue): Prisma.InputJsonObject {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const source = value as Record<string, unknown>;
    const contact: Record<string, string> = {};
    for (const key of ['phone', 'phoneNumber', 'email'] as const) {
      if (typeof source[key] === 'string' && source[key].trim()) contact[key] = source[key].trim();
    }
    return contact;
  }

  private safeAdvertisement(record: AdvertisementModerationRecord) {
    return { ...record, contactInfo: this.safeAdvertisementContact(record.contactInfo) };
  }

  async managedParkIds(user: AuthenticatedUser, db: Pick<Prisma.TransactionClient, 'industrialPark'> = this.prisma): Promise<string[]> {
    if (user.role === Role.SUPER_ADMIN) {
      const parks = await db.industrialPark.findMany({ select: { id: true } });
      return parks.map((park) => park.id);
    }
    const parks = await db.industrialPark.findMany({ where: { managers: { some: { id: user.id } } }, select: { id: true } });
    return parks.map((park) => park.id);
  }

  async inboxMessages(actor: AuthenticatedUser, query: { search?: string; subject?: string; fromDate?: string; toDate?: string } = {}) {
    return this.prisma.message.findMany({
      where: { receiverId: actor.id, ...this.messageSearchWhere(query) },
      include: { sender: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async sentMessages(actor: AuthenticatedUser, query: { search?: string; subject?: string; fromDate?: string; toDate?: string } = {}) {
    return this.prisma.message.findMany({
      where: { senderId: actor.id, ...this.messageSearchWhere(query) },
      include: { receiver: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async unreadMessageCount(actor: AuthenticatedUser) {
    const [messages, notifications] = await Promise.all([
      this.prisma.message.count({
        where: { receiverId: actor.id, status: MessageStatus.UNREAD },
      }),
      this.prisma.notification.count({
        where: { userId: actor.id, isRead: false },
      }),
    ]);
    return { count: messages + notifications, messages, notifications };
  }

  async listNotifications(actor: AuthenticatedUser) {
    return this.prisma.notification.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async markNotificationRead(actor: AuthenticatedUser, id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== actor.id) throw new ForbiddenException('You do not have access to this notification');
    if (notification.isRead) return notification;
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllNotificationsRead(actor: AuthenticatedUser) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: actor.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  }

  async markMessageRead(actor: AuthenticatedUser, id: string) {
    const message = await this.prisma.message.findUnique({ where: { id } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.receiverId !== actor.id) throw new ForbiddenException('You do not have access to this message');
    if (message.status === 'READ') return message;
    return this.prisma.message.update({ where: { id }, data: { status: 'READ' } });
  }

  async sendDirectMessage(actor: AuthenticatedUser, input: SendDirectMessageDto) {
    const allowed = await this.messageRecipients(actor);
    const allowedIds = new Set(allowed.map((item) => item.id));
    if (!allowedIds.has(input.receiverId)) {
      throw new ForbiddenException('Receiver is not in your allowed messaging scope');
    }

    const receiver = await this.prisma.user.findUnique({
      where: { id: input.receiverId },
      select: { id: true, name: true, phoneNumber: true, isActive: true, messagingRestricted: true, role: true },
    });
    if (!receiver?.isActive) throw new BadRequestException('Receiver is invalid or inactive');

    const privilegedSender = actor.role === Role.SUPER_ADMIN || actor.role === Role.PARK_MANAGER;
    if (receiver.messagingRestricted && !privilegedSender) {
      throw new ForbiddenException('This manager has restricted unsolicited messaging');
    }

    const message = await this.prisma.message.create({
      data: {
        senderId: actor.id,
        receiverId: receiver.id,
        subject: input.subject,
        body: input.body,
        attachments: input.attachments || [],
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        receiver: { select: { id: true, name: true, role: true } },
      },
    });
    await this.audit.record({ userId: actor.id, action: 'MESSAGE_SENT', entity: 'Message', entityId: message.id });
    // Do not create a parallel in-app Notification here — the Message inbox is the source of truth.
    if (receiver.phoneNumber) {
      const sender = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { name: true } });
      const smsText = actor.role === Role.PARK_MANAGER && receiver.role === Role.FACTORY_OWNER
        ? `کاربر گرامی مدیر واحد صنعتی ${receiver.name}، یک پیام از مدیر شهرک صنعتی ${sender?.name || 'مدیر شهرک'} در سامانه کاربری مکص شما ارسال گردیده است. لطفاً آن را بررسی بفرمایید.`
        : `MEKSS: پیام جدید با موضوع «${input.subject}» در سامانه مکص برای شما ارسال شد.`;
      await this.safeSendSms(receiver.phoneNumber, smsText);
    }
    return message;
  }

  async sendMessage(actor: AuthenticatedUser, recipientIds: string[], subject: string, body: string) {
    const allowed = await this.messageRecipients(actor);
    const allowedIds = new Set(allowed.map((item) => item.id));
    const scopedIds = Array.from(new Set(recipientIds)).filter((id) => allowedIds.has(id));
    const validRecipients = await this.prisma.user.findMany({
      where: { id: { in: scopedIds }, isActive: true },
      select: { id: true, phoneNumber: true },
    });
    if (!validRecipients.length) throw new BadRequestException('No valid recipients were resolved');
    const excludedCount = Math.max(0, Array.from(new Set(recipientIds)).length - validRecipients.length);
    const created = await this.prisma.$transaction(
      validRecipients.map((recipient) => this.prisma.message.create({
        data: { senderId: actor.id, receiverId: recipient.id, subject, body },
      })),
    );
    await this.audit.record({
      userId: actor.id,
      action: 'MESSAGE_BATCH_SENT',
      entity: 'Message',
      entityId: created.map((message) => message.id).join(','),
      changes: { recipientCount: created.length },
    });
    await Promise.all(validRecipients.map(async (recipient) => {
      if (recipient.phoneNumber) await this.safeSendSms(recipient.phoneNumber, `MEKSS پیام جدید: ${subject}`);
    }));
    return { sentCount: created.length, excludedCount };
  }

  /** Broadcast one message to every factory owner in the actor's managed parks. */
  async broadcastToFactoryManagers(actor: AuthenticatedUser, subject: string, body: string) {
    return this.broadcastMessage(actor, { subject, body, audience: 'PARK_ALL' });
  }

  async broadcastMessage(actor: AuthenticatedUser, input: {
    subject: string;
    body: string;
    audience: 'SYSTEM_ALL' | 'PARK_ALL' | 'FACTORY_UNIT' | 'FACTORY_EMPLOYEES';
    parkId?: string;
    factoryId?: string;
  }) {
    this.text(input.subject, 'subject');
    this.text(input.body, 'body');
    const recipientIds = await this.resolveBroadcastRecipientIds(actor, input);
    if (!recipientIds.length) throw new BadRequestException('No recipients found for the selected audience');
    return this.sendMessage(actor, recipientIds, input.subject.trim(), input.body.trim());
  }

  private async resolveBroadcastRecipientIds(
    actor: AuthenticatedUser,
    input: {
      audience: 'SYSTEM_ALL' | 'PARK_ALL' | 'FACTORY_UNIT' | 'FACTORY_EMPLOYEES';
      parkId?: string;
      factoryId?: string;
    },
  ): Promise<string[]> {
    if (input.audience === 'SYSTEM_ALL') {
      if (actor.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException('Only super admins can broadcast to the entire system');
      }
      const users = await this.prisma.user.findMany({
        where: { isActive: true, isApproved: true, id: { not: actor.id } },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }

    if (input.audience === 'PARK_ALL') {
      if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.PARK_MANAGER) {
        throw new ForbiddenException('Only park managers can broadcast to a park');
      }
      const parkIds = actor.role === Role.SUPER_ADMIN
        ? (input.parkId ? [input.parkId] : await this.managedParkIds(actor))
        : await this.managedParkIds(actor);
      if (input.parkId) {
        if (!parkIds.includes(input.parkId) && actor.role !== Role.SUPER_ADMIN) {
          throw new ForbiddenException('You do not have access to this park');
        }
      }
      const targetParkIds = input.parkId ? [input.parkId] : parkIds;
      if (!targetParkIds.length) throw new BadRequestException('No park scope available for broadcast');
      return this.parkMessagingAudienceIds(targetParkIds, actor.id);
    }

    if (input.audience === 'FACTORY_UNIT') {
      if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.PARK_MANAGER) {
        throw new ForbiddenException('Only park managers can broadcast to a factory unit');
      }
      if (!input.factoryId) throw new BadRequestException('factoryId is required for FACTORY_UNIT audience');
      await this.assertFactoryAccess(actor, input.factoryId);
      return this.factoryUnitMessagingAudienceIds(input.factoryId, actor.id);
    }

    if (input.audience === 'FACTORY_EMPLOYEES') {
      if (actor.role !== Role.FACTORY_OWNER && actor.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException('Only factory owners can broadcast to all employees');
      }
      let factoryIds: string[] = [];
      if (actor.role === Role.FACTORY_OWNER) {
        const factories = await this.prisma.factory.findMany({ where: { managerId: actor.id }, select: { id: true } });
        factoryIds = factories.map((f) => f.id);
      } else if (input.factoryId) {
        factoryIds = [input.factoryId];
      } else {
        throw new BadRequestException('factoryId is required');
      }
      if (!factoryIds.length) throw new BadRequestException('No factory scope available for employee broadcast');
      const employees = await this.prisma.user.findMany({
        where: {
          employeeOfFactoryId: { in: factoryIds },
          role: Role.EMPLOYEE,
          isActive: true,
          isApproved: true,
          id: { not: actor.id },
        },
        select: { id: true },
      });
      return employees.map((e) => e.id);
    }

    throw new BadRequestException('Unsupported broadcast audience');
  }

  /** Park-wide message audience: factory managers + active security guards. */
  private async parkMessagingAudienceIds(parkIds: string[], excludeUserId: string): Promise<string[]> {
    const [factories, guards] = await Promise.all([
      this.prisma.factory.findMany({
        where: { parkId: { in: parkIds }, isApproved: true },
        select: { managerId: true },
      }),
      this.prisma.securityGuard.findMany({
        where: { parkId: { in: parkIds }, isActive: true },
        select: { userId: true },
      }),
    ]);
    const managerIds = factories.map((f) => f.managerId).filter(Boolean) as string[];
    const guardIds = guards.map((g) => g.userId);
    const unique = [...new Set([...managerIds, ...guardIds])].filter((id) => id && id !== excludeUserId);
    if (!unique.length) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique }, isActive: true, isApproved: true },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  /** One factory unit: its manager + employees. */
  private async factoryUnitMessagingAudienceIds(factoryId: string, excludeUserId: string): Promise<string[]> {
    const factory = await this.prisma.factory.findUnique({
      where: { id: factoryId },
      select: { managerId: true },
    });
    if (!factory) throw new NotFoundException('Factory not found');
    const employees = await this.prisma.user.findMany({
      where: {
        employeeOfFactoryId: factoryId,
        role: Role.EMPLOYEE,
        isActive: true,
        isApproved: true,
        id: { not: excludeUserId },
      },
      select: { id: true },
    });
    const ids = [...new Set([factory.managerId, ...employees.map((e) => e.id)])]
      .filter((id) => id && id !== excludeUserId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids }, isActive: true, isApproved: true },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  async messageRecipients(actor: AuthenticatedUser) {
    const select = {
      id: true,
      name: true,
      phoneNumber: true,
      role: true,
      employeeOfFactoryId: true,
      employeeOfFactory: { select: { id: true, name: true } },
    } as const;

    if (actor.role === Role.SUPER_ADMIN) {
      return this.prisma.user.findMany({
        where: { isActive: true, isApproved: true, id: { not: actor.id } },
        select,
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
        take: 2000,
      });
    }

    if (actor.role === Role.PARK_MANAGER) {
      const parkIds = await this.managedParkIds(actor);
      if (!parkIds.length) return [];
      const [factories, guards] = await Promise.all([
        this.prisma.factory.findMany({
          where: { parkId: { in: parkIds }, isApproved: true },
          select: { id: true, name: true, managerId: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.securityGuard.findMany({
          where: { parkId: { in: parkIds }, isActive: true },
          select: { userId: true },
        }),
      ]);
      const factoryIds = factories.map((f) => f.id);
      const managerIds = factories.map((f) => f.managerId).filter(Boolean) as string[];
      const [managers, employees, activeGuards] = await Promise.all([
        this.prisma.user.findMany({
          where: {
            id: { in: managerIds, not: actor.id },
            role: Role.FACTORY_OWNER,
            isActive: true,
            isApproved: true,
          },
          select,
          orderBy: { name: 'asc' },
        }),
        this.prisma.user.findMany({
          where: {
            employeeOfFactoryId: { in: factoryIds },
            role: Role.EMPLOYEE,
            isActive: true,
            isApproved: true,
            id: { not: actor.id },
          },
          select,
          orderBy: { name: 'asc' },
        }),
        this.prisma.user.findMany({
          where: {
            id: { in: guards.map((g) => g.userId), not: actor.id },
            role: Role.SECURITY_GUARD,
            isActive: true,
            isApproved: true,
          },
          select,
          orderBy: { name: 'asc' },
        }),
      ]);
      const factoryByManager = new Map(factories.map((f) => [f.managerId, f]));
      const factoryById = new Map(factories.map((f) => [f.id, f]));
      return [
        ...managers.map((manager) => ({
          ...manager,
          factoryId: factoryByManager.get(manager.id)?.id || null,
          factoryName: factoryByManager.get(manager.id)?.name || null,
        })),
        ...activeGuards.map((user) => ({ ...user, factoryId: null as string | null, factoryName: null as string | null })),
        ...employees.map((user) => ({
          ...user,
          factoryId: user.employeeOfFactoryId,
          factoryName: user.employeeOfFactoryId
            ? factoryById.get(user.employeeOfFactoryId)?.name || user.employeeOfFactory?.name || null
            : null,
        })),
      ];
    }

    if (actor.role === Role.FACTORY_OWNER) {
      const factories = await this.prisma.factory.findMany({
        where: { managerId: actor.id },
        select: { id: true, parkId: true, name: true },
      });
      const factoryIds = factories.map((f) => f.id);
      const parkIds = [...new Set(factories.map((f) => f.parkId))];
      const [employees, parkManagers, peerManagers] = await Promise.all([
        this.prisma.user.findMany({
          where: { employeeOfFactoryId: { in: factoryIds }, role: Role.EMPLOYEE, isActive: true, isApproved: true },
          select,
          orderBy: { name: 'asc' },
        }),
        this.prisma.user.findMany({
          where: {
            role: Role.PARK_MANAGER,
            isActive: true,
            isApproved: true,
            messagingRestricted: false,
            managedParks: { some: { id: { in: parkIds } } },
          },
          select,
          orderBy: { name: 'asc' },
        }),
        this.prisma.factory.findMany({
          where: { parkId: { in: parkIds }, isApproved: true, managerId: { not: actor.id } },
          select: { id: true, name: true, managerId: true },
          orderBy: { name: 'asc' },
        }),
      ]);
      const peerManagerIds = [...new Set(peerManagers.map((f) => f.managerId).filter(Boolean))] as string[];
      const peerUsers = peerManagerIds.length
        ? await this.prisma.user.findMany({
          where: { id: { in: peerManagerIds }, role: Role.FACTORY_OWNER, isActive: true, isApproved: true },
          select,
          orderBy: { name: 'asc' },
        })
        : [];
      const peerFactoryByManager = new Map(peerManagers.map((f) => [f.managerId, f]));
      const factoryNameById = new Map(factories.map((f) => [f.id, f.name]));
      return [
        ...parkManagers.map((user) => ({ ...user, factoryId: null as string | null, factoryName: null as string | null })),
        ...peerUsers.map((user) => ({
          ...user,
          factoryId: peerFactoryByManager.get(user.id)?.id || null,
          factoryName: peerFactoryByManager.get(user.id)?.name || null,
        })),
        ...employees.map((user) => ({
          ...user,
          factoryId: user.employeeOfFactoryId,
          factoryName: user.employeeOfFactoryId ? factoryNameById.get(user.employeeOfFactoryId) || user.employeeOfFactory?.name || null : null,
        })),
      ];
    }

    if (actor.role === Role.EMPLOYEE) {
      const me = await this.prisma.user.findUnique({
        where: { id: actor.id },
        select: { employeeOfFactoryId: true, employeeOfFactory: { select: { managerId: true, parkId: true, name: true } } },
      });
      const targets: string[] = [];
      if (me?.employeeOfFactory?.managerId) targets.push(me.employeeOfFactory.managerId);
      const users = await this.prisma.user.findMany({
        where: { id: { in: targets }, isActive: true, isApproved: true },
        select,
      });
      return users.map((user) => ({
        ...user,
        factoryId: me?.employeeOfFactoryId || null,
        factoryName: me?.employeeOfFactory?.name || null,
      }));
    }

    return [];
  }

  async listFactoryStaff(actor: AuthenticatedUser, factoryId: string) {
    await this.assertOwnedFactory(actor, factoryId);
    return this.prisma.user.findMany({
      where: { employeeOfFactoryId: factoryId, role: Role.EMPLOYEE },
      select: STAFF_USER_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  async createFactoryStaff(actor: AuthenticatedUser, factoryId: string, input: CreateFactoryStaffDto) {
    await this.assertOwnedFactory(actor, factoryId);
    const factory = await this.prisma.factory.findUnique({ where: { id: factoryId }, select: { name: true, status: true, suspendedReason: true } });
    this.assertFactoryNotSuspended(factory);
    const password = await bcrypt.hash(input.password, 12);
    try {
      const created = await this.prisma.user.create({
        data: {
          phoneNumber: input.phoneNumber,
          name: input.name,
          password,
          role: Role.EMPLOYEE,
          isApproved: true,
          isActive: true,
          mustChangePassword: true,
          employeeOfFactoryId: factoryId,
          canApproveRequestTypes: input.canApproveRequestTypes,
        },
        select: STAFF_USER_SELECT,
      });
      await this.audit.record({
        userId: actor.id,
        action: 'FACTORY_STAFF_CREATED',
        entity: 'User',
        entityId: created.id,
        changes: { factoryId, canApproveRequestTypes: input.canApproveRequestTypes },
      });
      await this.sendStaffCredentialsSms(
        { phoneNumber: input.phoneNumber },
        factory?.name ? `واحد صنعتی «${factory.name}»` : 'واحد صنعتی',
      );
      return created;
    } catch (error) {
      if (this.prismaErrorCode(error) === 'P2002') throw new ConflictException('Phone number is already registered');
      throw error;
    }
  }

  async updateFactoryStaff(actor: AuthenticatedUser, factoryId: string, userId: string, input: UpdateFactoryStaffDto) {
    await this.assertOwnedFactory(actor, factoryId);
    if (input.canApproveRequestTypes === undefined && input.isActive === undefined) {
      throw new BadRequestException('At least one staff field is required');
    }
    const existing = await this.prisma.user.findFirst({
      where: { id: userId, employeeOfFactoryId: factoryId, role: Role.EMPLOYEE },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Staff user not found');
    const data: Prisma.UserUpdateInput = {
      ...(input.canApproveRequestTypes !== undefined ? { canApproveRequestTypes: input.canApproveRequestTypes } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive, ...(input.isActive === false ? { sessionVersion: { increment: 1 } } : {}) } : {}),
    };
    const updated = await this.prisma.user.update({ where: { id: userId }, data, select: STAFF_USER_SELECT });
    await this.audit.record({
      userId: actor.id,
      action: 'FACTORY_STAFF_UPDATED',
      entity: 'User',
      entityId: userId,
      changes: input as unknown as Prisma.InputJsonObject,
    });
    return updated;
  }

  async listParkStaff(actor: AuthenticatedUser, parkId?: string) {
    const scopeParkIds = await this.resolveParkStaffScope(actor, parkId);
    return this.prisma.user.findMany({
      where: {
        role: Role.EMPLOYEE,
        employeeOfParkId: { in: scopeParkIds },
        employeeOfFactoryId: null,
      },
      select: {
        ...PARK_STAFF_USER_SELECT,
        employeeOfPark: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  async createParkStaff(actor: AuthenticatedUser, input: CreateParkStaffDto) {
    const parkId = await this.resolveParkStaffParkId(actor, input.parkId);
    const password = await bcrypt.hash(input.password, 12);
    try {
      const created = await this.prisma.user.create({
        data: {
          phoneNumber: input.phoneNumber,
          name: input.name.trim(),
          password,
          username: input.username || null,
          nationalId: input.nationalId || null,
          email: input.email || null,
          role: Role.EMPLOYEE,
          isApproved: true,
          isActive: true,
          mustChangePassword: true,
          employeeOfParkId: parkId,
          employeeOfFactoryId: null,
          canApproveRequestTypes: [],
        },
        select: {
          ...PARK_STAFF_USER_SELECT,
          employeeOfPark: { select: { id: true, name: true, code: true } },
        },
      });
      await this.audit.record({
        userId: actor.id,
        action: 'PARK_STAFF_CREATED',
        entity: 'User',
        entityId: created.id,
        changes: { parkId, phoneNumber: input.phoneNumber, username: input.username || null },
      });
      await this.sendStaffCredentialsSms(
        { phoneNumber: input.phoneNumber, username: input.username },
        created.employeeOfPark?.name ? `مدیریت شهرک «${created.employeeOfPark.name}»` : 'مدیریت شهرک',
      );
      return created;
    } catch (error) {
      if (this.prismaErrorCode(error) === 'P2002') {
        throw new ConflictException('Phone number, username, national ID or email is already registered');
      }
      throw error;
    }
  }

  async updateParkStaff(actor: AuthenticatedUser, userId: string, input: UpdateParkStaffDto) {
    const keys = Object.keys(input).filter((key) => (input as Record<string, unknown>)[key] !== undefined);
    if (!keys.length) throw new BadRequestException('At least one staff field is required');

    const existing = await this.prisma.user.findFirst({
      where: {
        id: userId,
        role: Role.EMPLOYEE,
        employeeOfParkId: { not: null },
        employeeOfFactoryId: null,
      },
      select: { id: true, employeeOfParkId: true },
    });
    if (!existing?.employeeOfParkId) throw new NotFoundException('Park staff user not found');
    await this.assertManagedParkAccess(actor, existing.employeeOfParkId);

    const data: Prisma.UserUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.phoneNumber !== undefined) data.phoneNumber = input.phoneNumber;
    if (input.username !== undefined) data.username = input.username;
    if (input.nationalId !== undefined) data.nationalId = input.nationalId;
    if (input.email !== undefined) data.email = input.email;
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
      if (input.isActive === false) data.sessionVersion = { increment: 1 };
    }
    if (input.password) {
      data.password = await bcrypt.hash(input.password, 12);
      data.mustChangePassword = true;
      data.sessionVersion = { increment: 1 };
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data,
        select: {
          ...PARK_STAFF_USER_SELECT,
          employeeOfPark: { select: { id: true, name: true, code: true } },
        },
      });
      if (input.password || input.isActive === false) {
        await this.prisma.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await this.audit.record({
        userId: actor.id,
        action: 'PARK_STAFF_UPDATED',
        entity: 'User',
        entityId: userId,
        changes: {
          ...input,
          password: input.password ? '[redacted]' : undefined,
        } as unknown as Prisma.InputJsonObject,
      });
      if (input.password && updated.phoneNumber) {
        await this.sendStaffCredentialsSms(
          { phoneNumber: updated.phoneNumber, username: updated.username },
          updated.employeeOfPark?.name ? `مدیریت شهرک «${updated.employeeOfPark.name}»` : 'مدیریت شهرک',
          'password-reset',
        );
      }
      return updated;
    } catch (error) {
      if (this.prismaErrorCode(error) === 'P2002') {
        throw new ConflictException('Phone number, username, national ID or email is already registered');
      }
      throw error;
    }
  }

  async deleteParkStaff(actor: AuthenticatedUser, userId: string) {
    if (actor.id === userId) throw new ForbiddenException('You cannot delete your own account');
    const existing = await this.prisma.user.findFirst({
      where: {
        id: userId,
        role: Role.EMPLOYEE,
        employeeOfParkId: { not: null },
        employeeOfFactoryId: null,
      },
      select: { id: true, employeeOfParkId: true },
    });
    if (!existing?.employeeOfParkId) throw new NotFoundException('Park staff user not found');
    await this.assertManagedParkAccess(actor, existing.employeeOfParkId);

    const blockers = await this.userDeleteBlockers(this.prisma, userId);
    if (blockers.length) {
      // Soft-delete when hard delete is blocked by business relations.
      await this.prisma.user.update({
        where: { id: userId },
        data: { isActive: false, sessionVersion: { increment: 1 } },
      });
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({
        userId: actor.id,
        action: 'PARK_STAFF_DEACTIVATED',
        entity: 'User',
        entityId: userId,
        changes: { reason: 'protected_relations', blockers },
      });
      return { id: userId, deleted: false, deactivated: true };
    }

    await this.prisma.user.delete({ where: { id: userId } });
    await this.audit.record({
      userId: actor.id,
      action: 'PARK_STAFF_DELETED',
      entity: 'User',
      entityId: userId,
    });
    return { id: userId, deleted: true, deactivated: false };
  }

  static readonly WALLET_TOP_UP_MIN = 10_000;
  static readonly WALLET_TOP_UP_MAX = 2_000_000_000;
  /** Unverified gateway sessions older than this are abandoned (ZarinPal refunds unverified payments). */
  static readonly WALLET_TOP_UP_EXPIRY_MS = 24 * 60 * 60 * 1000;

  async factoryWallet(actor: AuthenticatedUser, factoryId: string) {
    await this.assertFactoryAccess(actor, factoryId);
    const factory = await this.prisma.factory.findUnique({
      where: { id: factoryId },
      select: { id: true, name: true, gatePassWalletBalance: true },
    });
    if (!factory) throw new NotFoundException('Factory not found');
    const balance = Number(factory.gatePassWalletBalance);
    await this.prisma.walletTopUp.updateMany({
      where: {
        factoryId,
        status: PaymentStatus.INITIATED,
        createdAt: { lt: new Date(Date.now() - ManagementService.WALLET_TOP_UP_EXPIRY_MS) },
      },
      data: { status: PaymentStatus.CANCELLED, failureReason: 'Payment session expired' },
    });
    const [fee, walletRequired, topUps] = await Promise.all([
      Promise.resolve(this.gatePassFee()),
      this.isGatePassWalletRequired(),
      this.prisma.walletTopUp.findMany({
        where: { factoryId },
        select: {
          id: true,
          amount: true,
          status: true,
          method: true,
          provider: true,
          referenceId: true,
          failureReason: true,
          balanceAfter: true,
          verifiedAt: true,
          createdAt: true,
          initiatedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);
    return {
      factoryId: factory.id,
      name: factory.name,
      balance,
      fee,
      walletRequired,
      passesRemaining: fee > 0 ? Math.floor(balance / fee) : null,
      minTopUp: ManagementService.WALLET_TOP_UP_MIN,
      maxTopUp: ManagementService.WALLET_TOP_UP_MAX,
      paymentProvider: this.paymentProvider(),
      topUps: topUps.map((row) => ({
        ...row,
        amount: Number(row.amount),
        balanceAfter: row.balanceAfter === null ? null : Number(row.balanceAfter),
      })),
    };
  }

  /** Manual credit by a park manager / super admin (cash, bank transfer, ...), recorded in the top-up ledger. */
  async topUpFactoryWallet(actor: AuthenticatedUser, factoryId: string, amount: number) {
    await this.assertFactoryAccess(actor, factoryId);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Invalid top-up amount');
    const factory = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.factory.update({
        where: { id: factoryId },
        data: { gatePassWalletBalance: { increment: amount } },
        select: { id: true, name: true, managerId: true, gatePassWalletBalance: true },
      });
      await tx.walletTopUp.create({
        data: {
          factoryId,
          amount,
          status: PaymentStatus.VERIFIED,
          method: 'MANUAL',
          provider: 'MANUAL',
          authority: `manual-${randomBytes(16).toString('hex')}`,
          balanceAfter: updated.gatePassWalletBalance,
          verifiedAt: new Date(),
          initiatedById: actor.id,
        },
      });
      return updated;
    });
    await this.audit.record({
      userId: actor.id,
      action: 'FACTORY_WALLET_TOP_UP',
      entity: 'Factory',
      entityId: factoryId,
      changes: { amount, method: 'MANUAL' },
    });
    if (factory.managerId && factory.managerId !== actor.id) {
      await this.notifyUser(
        factory.managerId,
        'شارژ کیف پول واحد',
        `کیف پول واحد «${factory.name}» به مبلغ ${this.formatRial(amount)} ریال توسط مدیریت شهرک شارژ شد. موجودی فعلی: ${this.formatRial(Number(factory.gatePassWalletBalance))} ریال.`,
        'SUCCESS',
      );
    }
    return { factoryId: factory.id, name: factory.name, balance: Number(factory.gatePassWalletBalance) };
  }

  /** Starts an online wallet top-up through the payment gateway (unit owner, or staff on the unit's behalf). */
  async startWalletTopUp(actor: AuthenticatedUser, factoryId: string, amount: number) {
    await this.assertFactoryAccess(actor, factoryId);
    if (!Number.isInteger(amount) || amount < ManagementService.WALLET_TOP_UP_MIN || amount > ManagementService.WALLET_TOP_UP_MAX) {
      throw new BadRequestException('Invalid top-up amount');
    }
    const factory = await this.prisma.factory.findUnique({ where: { id: factoryId }, select: { id: true, name: true } });
    if (!factory) throw new NotFoundException('Factory not found');

    const provider = this.paymentProvider();
    if (provider === 'mock' && !this.mockPaymentsAllowed()) {
      throw new BadRequestException('Online payment gateway is not configured');
    }
    const callbackUrl = this.walletCallbackUrl();
    let authority = randomBytes(18).toString('hex');
    let paymentUrl = `${callbackUrl}?Authority=${authority}&Status=OK`;
    if (provider === 'zarinpal') {
      const merchantId = this.config.get<string>('ZARINPAL_MERCHANT_ID');
      if (!merchantId) throw new BadRequestException('ZarinPal is not configured');
      const baseUrl = this.zarinpalBaseUrl();
      const response = await fetch(`${baseUrl}/pg/v4/payment/request.json`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          merchant_id: merchantId,
          amount,
          callback_url: callbackUrl,
          description: `شارژ کیف پول برگ خروج واحد «${factory.name}»`,
          metadata: actor.phoneNumber ? { mobile: actor.phoneNumber } : undefined,
        }),
      });
      const result: any = await response.json().catch(() => null);
      if (!response.ok || result?.data?.code !== 100 || !result?.data?.authority) {
        throw new BadRequestException('Unable to initialize ZarinPal payment');
      }
      authority = result.data.authority;
      paymentUrl = `${baseUrl}/pg/StartPay/${authority}`;
    }

    const topUp = await this.prisma.walletTopUp.create({
      data: {
        factoryId,
        amount,
        authority,
        method: 'ONLINE',
        provider: provider === 'zarinpal' ? 'ZARINPAL' : 'MOCK',
        initiatedById: actor.id,
      },
      select: { id: true },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'WALLET_TOP_UP_INITIATED',
      entity: 'Factory',
      entityId: factoryId,
      changes: { amount, topUpId: topUp.id, provider },
    });
    return { topUpId: topUp.id, authority, paymentUrl, amount };
  }

  /**
   * Gateway callback: verifies the payment and credits the wallet exactly once.
   * Returns the frontend URL to redirect the payer to (never throws).
   */
  async handleWalletTopUpCallback(authority: string, status: string): Promise<string> {
    let result: { status: 'success' | 'failed'; amount?: number; referenceId?: string | null; factoryId?: string };
    try {
      result = await this.verifyWalletTopUp(authority, status);
    } catch (error) {
      this.logger.error(`Wallet top-up verification failed for ${String(authority).slice(0, 8)}…: ${error instanceof Error ? error.message : 'unknown error'}`);
      result = { status: 'failed' };
    }
    const frontendUrl = (this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173').trim().replace(/\/+$/, '');
    const params = new URLSearchParams({ topup: result.status });
    if (result.amount) params.set('amount', String(result.amount));
    if (result.referenceId) params.set('ref', result.referenceId);
    if (result.factoryId) params.set('factoryId', result.factoryId);
    return `${frontendUrl}/factory/wallet?${params.toString()}`;
  }

  async verifyWalletTopUp(authority: string, status: string) {
    if (!authority) return { status: 'failed' as const };
    const topUp = await this.prisma.walletTopUp.findUnique({
      where: { authority },
      include: {
        factory: { select: { id: true, name: true } },
        initiatedBy: { select: { id: true, phoneNumber: true } },
      },
    });
    if (!topUp) return { status: 'failed' as const };
    const amount = Number(topUp.amount);
    const base = { amount, factoryId: topUp.factoryId };
    if (topUp.status === PaymentStatus.VERIFIED) return { ...base, status: 'success' as const, referenceId: topUp.referenceId };
    if (topUp.status !== PaymentStatus.INITIATED) return { ...base, status: 'failed' as const };

    const markFailed = async (failureReason: string, providerStatus?: unknown) => {
      await this.prisma.walletTopUp.updateMany({
        where: { id: topUp.id, status: PaymentStatus.INITIATED },
        data: {
          status: status === 'OK' ? PaymentStatus.FAILED : PaymentStatus.CANCELLED,
          failureReason,
          ...(providerStatus ? { providerStatus: providerStatus as Prisma.InputJsonValue } : {}),
        },
      });
      return { ...base, status: 'failed' as const };
    };
    if (status !== 'OK') return markFailed('Gateway cancelled payment');
    if (topUp.provider === 'MOCK' && !this.mockPaymentsAllowed()) return markFailed('Mock payments are disabled');
    if (Date.now() - topUp.createdAt.getTime() > ManagementService.WALLET_TOP_UP_EXPIRY_MS) {
      return markFailed('Payment session expired');
    }

    let referenceId = `MOCK-${randomBytes(6).toString('hex').toUpperCase()}`;
    let providerStatus: Record<string, unknown> = { mode: 'mock' };
    if (topUp.provider === 'ZARINPAL') {
      const merchantId = this.config.get<string>('ZARINPAL_MERCHANT_ID');
      if (!merchantId) throw new BadRequestException('ZarinPal is not configured');
      const response = await fetch(`${this.zarinpalBaseUrl()}/pg/v4/payment/verify.json`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ merchant_id: merchantId, amount, authority }),
      });
      const result: any = await response.json().catch(() => null);
      if (!response.ok || ![100, 101].includes(result?.data?.code)) {
        return markFailed('ZarinPal verification failed', result || {});
      }
      referenceId = String(result.data.ref_id);
      providerStatus = result;
    }

    const credited = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.walletTopUp.updateMany({
        where: { id: topUp.id, status: PaymentStatus.INITIATED },
        data: {
          status: PaymentStatus.VERIFIED,
          referenceId,
          verifiedAt: new Date(),
          providerStatus: providerStatus as Prisma.InputJsonValue,
        },
      });
      if (claimed.count !== 1) return null;
      const factory = await tx.factory.update({
        where: { id: topUp.factoryId },
        data: { gatePassWalletBalance: { increment: amount } },
        select: { gatePassWalletBalance: true },
      });
      await tx.walletTopUp.update({ where: { id: topUp.id }, data: { balanceAfter: factory.gatePassWalletBalance } });
      return Number(factory.gatePassWalletBalance);
    });
    if (credited === null) {
      // A concurrent callback already settled this top-up; report its final state.
      const settled = await this.prisma.walletTopUp.findUnique({ where: { id: topUp.id }, select: { status: true, referenceId: true } });
      return settled?.status === PaymentStatus.VERIFIED
        ? { ...base, status: 'success' as const, referenceId: settled.referenceId }
        : { ...base, status: 'failed' as const };
    }

    await this.audit.record({
      userId: topUp.initiatedById || undefined,
      action: 'WALLET_TOP_UP_VERIFIED',
      entity: 'Factory',
      entityId: topUp.factoryId,
      changes: { amount, referenceId, balanceAfter: credited },
    });
    const message = `کیف پول واحد «${topUp.factory.name}» به مبلغ ${this.formatRial(amount)} ریال شارژ شد. کد پیگیری: ${referenceId} — موجودی: ${this.formatRial(credited)} ریال.`;
    if (topUp.initiatedById) await this.notifyUser(topUp.initiatedById, 'شارژ موفق کیف پول', message, 'SUCCESS');
    if (topUp.initiatedBy?.phoneNumber) await this.safeSendSms(topUp.initiatedBy.phoneNumber, `MEKSS: ${message}`);
    return { ...base, status: 'success' as const, referenceId };
  }

  private mockPaymentsAllowed() {
    return this.config.get<string>('NODE_ENV') !== 'production' || this.config.get<string>('PAYMENT_ALLOW_MOCK') === 'true';
  }

  private paymentProvider(): 'mock' | 'zarinpal' {
    return (this.config.get<string>('PAYMENT_PROVIDER', 'mock') || 'mock').toLowerCase() === 'zarinpal' ? 'zarinpal' : 'mock';
  }

  private zarinpalBaseUrl() {
    return this.config.get<string>('ZARINPAL_SANDBOX', 'true') === 'true' ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
  }

  private walletCallbackUrl() {
    const explicit = this.config.get<string>('ZARINPAL_WALLET_CALLBACK_URL');
    if (explicit) return explicit;
    const invoiceCallback = this.config.get<string>('ZARINPAL_CALLBACK_URL');
    let origin = 'http://localhost:3000';
    if (invoiceCallback) {
      try {
        origin = new URL(invoiceCallback).origin;
      } catch {
        /* keep default */
      }
    }
    return `${origin}/api/v1/wallet/payment/callback`;
  }

  private formatRial(value: number) {
    return Math.round(value).toLocaleString('en-US');
  }

  async listMarketRates() {
    await this.ensureMarketRatesSeeded();
    // Best-effort live refresh when rates are stale (> 30 minutes).
    try {
      const newest = await this.prisma.marketRate.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } });
      if (!newest || Date.now() - newest.updatedAt.getTime() > 30 * 60_000) {
        await this.refreshMarketRatesFromProviders();
      }
    } catch {
      /* keep seeded/cached values */
    }
    return this.prisma.marketRate.findMany({ orderBy: { key: 'asc' } });
  }

  async marketRateHistory(days = 14) {
    await this.ensureMarketRatesSeeded();
    const since = new Date(Date.now() - Math.max(1, Math.min(days, 90)) * 24 * 60 * 60_000);
    const rows = await this.prisma.marketRateHistory.findMany({
      where: { recordedAt: { gte: since } },
      orderBy: { recordedAt: 'asc' },
    });
    return rows.map((row) => ({
      key: row.key,
      value: Number(row.value),
      recordedAt: row.recordedAt,
    }));
  }

  async refreshMarketRates(actor: AuthenticatedUser) {
    await this.ensureMarketRatesSeeded();
    const updated = await this.refreshMarketRatesFromProviders(actor.id);
    await this.audit.record({ userId: actor.id, action: 'MARKET_RATES_REFRESHED', entity: 'MarketRate', entityId: 'bulk', changes: { count: updated } });
    return this.listMarketRates();
  }

  async updateMarketRate(actor: AuthenticatedUser, key: MarketRateKey, input: UpdateMarketRateDto) {
    await this.ensureMarketRatesSeeded();
    const defaults = MARKET_RATE_DEFAULTS[key];
    const updated = await this.prisma.marketRate.update({
      where: { key },
      data: {
        value: input.value,
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        updatedById: actor.id,
      },
    });
    await this.prisma.marketRateHistory.create({
      data: { key, value: input.value, marketRateId: updated.id },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'MARKET_RATE_UPDATED',
      entity: 'MarketRate',
      entityId: updated.id,
      changes: { key, value: input.value, label: input.label ?? defaults.label, unit: input.unit ?? defaults.unit },
    });
    return updated;
  }

  async publicParks() {
    return this.prisma.industrialPark.findMany({
      where: { status: ParkStatus.ACTIVE },
      select: { id: true, name: true, province: true, city: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async publicFactories() {
    const factories = await this.prisma.factory.findMany({
      where: { status: FactoryStatus.ACTIVE, isApproved: true },
      select: {
        id: true,
        name: true,
        parkId: true,
        activityType: true,
        ceoName: true,
        logo: true,
        shopUrl: true,
        website: true,
        phoneNumber: true,
        email: true,
        socialMedia: true,
        description: true,
        park: { select: { id: true, name: true, city: true, province: true } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return factories.map((factory) => ({
      id: factory.id,
      name: factory.name,
      parkId: factory.parkId,
      activityType: factory.activityType,
      parkName: factory.park.name,
      city: factory.park.city,
      province: factory.park.province,
      ceoName: factory.ceoName,
      logo: factory.logo,
      shopUrl: factory.shopUrl,
      website: factory.website,
      phoneNumber: factory.phoneNumber,
      email: factory.email,
      socialMedia: factory.socialMedia,
      description: factory.description ? factory.description.slice(0, 280) : null,
    }));
  }

  async publicFactoryDetail(id: string) {
    const factory = await this.prisma.factory.findFirst({
      where: { id, status: FactoryStatus.ACTIVE, isApproved: true },
      select: {
        id: true,
        name: true,
        activityType: true,
        address: true,
        ceoName: true,
        logo: true,
        shopUrl: true,
        website: true,
        phoneNumber: true,
        email: true,
        socialMedia: true,
        description: true,
        latitude: true,
        longitude: true,
        park: { select: { id: true, name: true, city: true, province: true } },
      },
    });
    if (!factory) throw new NotFoundException('Factory not found');
    return factory;
  }

  async publicShops() {
    return this.prisma.factory.findMany({
      where: {
        status: FactoryStatus.ACTIVE,
        isApproved: true,
        shopUrl: { not: null },
      },
      select: {
        id: true,
        name: true,
        shopUrl: true,
        logo: true,
        activityType: true,
        park: { select: { name: true, city: true, province: true } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async createPublicSmsRequest(input: PublicSmsRequestDto) {
    const code = input.code.trim();
    if (SMS_GATE_PASS_CODES.has(code)) {
      return this.createPublicSmsGatePassRequest(input, code);
    }
    const type = SMS_REQUEST_CODE_MAP[code];
    if (!type) throw new BadRequestException('Unsupported SMS request code');
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber: input.phoneNumber },
      select: {
        id: true,
        isActive: true,
        isApproved: true,
        role: true,
        employeeOfFactoryId: true,
        managedFactories: { select: { id: true }, orderBy: { createdAt: 'asc' }, take: 1 },
      },
    });
    if (!user?.isActive || !user.isApproved) throw new BadRequestException('No eligible account found for this phone number');
    const factoryId = user.role === Role.FACTORY_OWNER
      ? user.managedFactories[0]?.id
      : user.employeeOfFactoryId;
    if (!factoryId) throw new BadRequestException('No factory is linked to this phone number');
    this.assertFactoryNotSuspended(await this.prisma.factory.findUnique({ where: { id: factoryId }, select: { status: true, suspendedReason: true } }));
    const title = `درخواست پیامکی ${type}`;
    const description = input.text?.trim() || `ثبت خودکار درخواست از طریق پیامک با کد ${input.code}`;
    const request = await this.prisma.request.create({
      data: {
        factoryId,
        type,
        title,
        description,
        data: { source: 'sms', code: input.code, text: input.text ?? null },
        attachments: [],
        priority: 'MEDIUM',
        isToParkManager: false,
        creatorId: user.id,
        status: RequestStatus.PENDING,
      },
    });
    return { ok: true, requestId: request.id };
  }

  async report(actor: AuthenticatedUser, type: 'financial' | 'gatepass' | 'requests', from?: string, to?: string) {
    const factoryIds = await this.factoryIds(actor);
    const hasGlobalFactoryScope = actor.role === Role.SUPER_ADMIN || actor.role === Role.GOVERNMENT_OFFICIAL;
    const factoryWhere = hasGlobalFactoryScope ? {} : { factoryId: { in: factoryIds } };
    const dateFilter = from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(`${to}T23:59:59.999Z`) : undefined } : undefined;
    const generatedAt = new Date().toISOString();

    if (type === 'financial') {
      const invoices = await this.prisma.invoice.findMany({
        where: {
          targetType: InvoiceTarget.FACTORY,
          ...factoryWhere,
          ...(dateFilter ? { issueDate: dateFilter } : {}),
        },
        include: { factory: { select: { id: true, name: true } } },
        orderBy: { issueDate: 'desc' },
        take: 2000,
      });
      const totals = invoices.reduce((acc, invoice) => {
        // A split parent is represented by its installments; counting both would double the debt.
        if (this.isSplitParent(invoice)) return acc;
        const settlement = this.computeInvoiceSettlement(invoice);
        acc.total += settlement.payableAmount;
        if (invoice.status === InvoiceStatus.PAID) acc.paid += settlement.payableAmount;
        acc.latePenalty += settlement.latePenaltyAmount;
        return acc;
      }, { total: 0, paid: 0, latePenalty: 0 });
      const byStatusMap = invoices.reduce((acc, invoice) => {
        const presented = this.presentInvoice(invoice);
        acc[presented.status] = (acc[presented.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      return {
        type,
        generatedAt,
        from: from || null,
        to: to || null,
        count: invoices.length,
        totalAmount: totals.total,
        paidAmount: totals.paid,
        unpaidAmount: totals.total - totals.paid,
        latePenaltyAmount: totals.latePenalty,
        byStatus: Object.entries(byStatusMap).map(([status, count]) => ({ status, count })),
        items: invoices.map((invoice) => {
          const settlement = this.computeInvoiceSettlement(invoice);
          return {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            factoryName: invoice.factory?.name || '',
            description: invoice.description,
            amount: Number(invoice.amount),
            taxAmount: Number(invoice.taxAmount),
            totalAmount: Number(invoice.totalAmount),
            latePenaltyPerDay: settlement.latePenaltyPerDay,
            lateDays: settlement.lateDays,
            latePenaltyAmount: settlement.latePenaltyAmount,
            payableAmount: settlement.payableAmount,
            status: settlement.status,
            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,
            paymentDate: invoice.paymentDate,
          };
        }),
      };
    }

    if (type === 'gatepass') {
      const passes = await this.prisma.gatePass.findMany({
        where: { ...factoryWhere, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        include: { factory: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 2000,
      });
      const byStatusMap = passes.reduce((acc, pass) => {
        acc[pass.status] = (acc[pass.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      return {
        type,
        generatedAt,
        from: from || null,
        to: to || null,
        count: passes.length,
        byStatus: Object.entries(byStatusMap).map(([status, count]) => ({ status, count })),
        items: passes.map((pass) => ({
          id: pass.id,
          factoryName: pass.factory?.name || '',
          driverName: pass.driverName,
          licensePlate: pass.licensePlate,
          cargoType: pass.cargoType,
          vehicleType: pass.vehicleType,
          status: pass.status,
          qrCode: pass.qrCode,
          exitDate: pass.exitDate,
          createdAt: pass.createdAt,
          verifiedAt: pass.verifiedAt,
        })),
      };
    }

    const requests = await this.prisma.request.findMany({
      where: { ...factoryWhere, ...(dateFilter ? { createdAt: dateFilter } : {}) },
      include: {
        factory: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });
    const byStatusMap = requests.reduce((acc, request) => {
      acc[request.status] = (acc[request.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      type,
      generatedAt,
      from: from || null,
      to: to || null,
      count: requests.length,
      byStatus: Object.entries(byStatusMap).map(([status, count]) => ({ status, count })),
      items: requests.map((request) => ({
        id: request.id,
        title: request.title,
        type: request.type,
        factoryName: request.factory?.name || '',
        creatorName: request.creator?.name || '',
        status: request.status,
        priority: request.priority,
        createdAt: request.createdAt,
        approvedAt: request.approvedAt,
        rejectedAt: request.rejectedAt,
      })),
    };
  }

  async smsHealth() {
    const provider = this.config.get<string>('SMS_PROVIDER', 'mock').toLowerCase();
    const sender = this.config.get<string>('SMS_SENDER');
    const configured = provider === 'mock' || Boolean(this.config.get<string>('KAVEH_NEGAR_API_KEY'));
    return { provider, configured, maskedSender: sender ? `${sender.slice(0, 4)}***${sender.slice(-2)}` : null };
  }

  private async userLifecycleTransaction<T>(
    actor: AuthenticatedUser,
    targetId: string | undefined,
    operation: (tx: Prisma.TransactionClient) => Promise<UserMutationOutcome<T>>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // Serialize user-administration mutations. Row locks alone cannot prevent two
      // administrators from concurrently removing the final two eligible admins.
      await tx.$queryRaw(Prisma.sql`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(73463551920838::bigint)`);
      const currentActor = await tx.user.findUnique({
        where: { id: actor.id },
        select: { id: true, role: true, isActive: true, isApproved: true },
      });
      if (!currentActor || currentActor.role !== Role.SUPER_ADMIN || !currentActor.isActive || !currentActor.isApproved) {
        throw new ForbiddenException('Administrative access is no longer active');
      }
      if (targetId) {
        const locked = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${targetId} FOR UPDATE`,
        );
        if (!locked.length) throw new NotFoundException('User not found');
      }

      const outcome = await operation(tx);
      if (outcome.audit) {
        const inferredId = (outcome.result as { id?: unknown })?.id;
        const entityId = targetId ?? (typeof inferredId === 'string' ? inferredId : undefined);
        if (!entityId) throw new Error('User lifecycle audit requires an entity id');
        await this.audit.record({
          userId: actor.id,
          actorIdentifier: actor.id,
          action: outcome.audit.action,
          entity: 'User',
          entityId,
          changes: outcome.audit.changes,
          correlationId: currentCorrelationId(),
        }, tx);
      }
      return outcome.result;
    });
  }

  private safeUserSummary(user: UserListRecord) {
    const { _count, ...safe } = user;
    return { ...safe, relationshipSummary: _count };
  }

  private safeUserDetail(user: UserDetailRecord) {
    const { _count, ...safe } = user;
    return { ...safe, relationshipSummary: _count };
  }

  private uniqueIds(ids: string[], field: string): string[] {
    const unique = [...new Set(ids)].sort();
    if (unique.length !== ids.length) throw new BadRequestException(`${field} must contain unique identifiers`);
    return unique;
  }

  private sameIds(left: string[], right: string[]): boolean {
    return left.length === right.length && left.every((id, index) => id === right[index]);
  }

  private assertCreateAssignmentCompatibility(role: Role, parkIds: string[], factoryIds: string[], employeeFactoryId: string | null): void {
    const compatible = role === Role.PARK_MANAGER
      ? factoryIds.length === 0 && !employeeFactoryId
      : role === Role.FACTORY_OWNER
        ? parkIds.length === 0 && !employeeFactoryId
        : role === Role.EMPLOYEE
          ? parkIds.length === 0 && factoryIds.length === 0
          : parkIds.length === 0 && factoryIds.length === 0 && !employeeFactoryId;
    if (!compatible) throw new BadRequestException(`Assignments are incompatible with the ${role} role`);
  }

  private async assertAssignmentTargets(
    tx: Prisma.TransactionClient,
    parkIds: string[],
    factoryIds: string[],
    employeeFactoryId: string | null,
  ): Promise<void> {
    const [parkCount, factoryCount, employeeFactoryCount] = await Promise.all([
      parkIds.length ? tx.industrialPark.count({ where: { id: { in: parkIds } } }) : 0,
      factoryIds.length ? tx.factory.count({ where: { id: { in: factoryIds } } }) : 0,
      employeeFactoryId ? tx.factory.count({ where: { id: employeeFactoryId } }) : 0,
    ]);
    if (parkCount !== parkIds.length) throw new BadRequestException('One or more managed parks do not exist');
    if (factoryCount !== factoryIds.length) throw new BadRequestException('One or more managed factories do not exist');
    if (employeeFactoryId && employeeFactoryCount !== 1) throw new BadRequestException('Employee factory does not exist');
  }

  private isActiveApprovedSuperAdmin(user: { role: Role; isActive: boolean; isApproved: boolean }): boolean {
    return user.role === Role.SUPER_ADMIN && user.isActive && user.isApproved;
  }

  private async assertAnotherActiveSuperAdmin(tx: Prisma.TransactionClient, targetId: string): Promise<void> {
    const remaining = await tx.user.count({
      where: { id: { not: targetId }, role: Role.SUPER_ADMIN, isActive: true, isApproved: true },
    });
    if (remaining < 1) throw new ForbiddenException('Cannot remove the final active approved super administrator');
  }

  private async userDeleteBlockers(tx: Prisma.TransactionClient, userId: string): Promise<string[]> {
    const names = [
      'managedFactories', 'managedParks', 'gatePasses', 'invoices', 'messages', 'requests',
      'announcements', 'advertisements', 'favorites', 'securityShifts', 'notifications',
      'emergencies', 'paymentAttempts', 'uploadedFiles', 'feedback', 'marketRateUpdates',
    ];
    const counts = await Promise.all([
      tx.factory.count({ where: { managerId: userId } }),
      tx.industrialPark.count({ where: { managers: { some: { id: userId } } } }),
      tx.gatePass.count({ where: { OR: [{ createdById: userId }, { approvedById: userId }, { verifiedById: userId }] } }),
      tx.invoice.count({ where: { OR: [{ createdById: userId }, { paidById: userId }] } }),
      tx.message.count({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } }),
      tx.request.count({ where: { OR: [{ creatorId: userId }, { approverId: userId }] } }),
      tx.announcement.count({ where: { createdById: userId } }),
      tx.advertisement.count({ where: { OR: [{ createdById: userId }, { moderatedById: userId }] } }),
      tx.advertisementFavorite.count({ where: { userId } }),
      tx.securityGuard.count({ where: { userId } }),
      tx.notification.count({ where: { userId } }),
      tx.emergencyAlert.count({ where: { createdById: userId } }),
      tx.paymentTransaction.count({ where: { initiatedById: userId } }),
      tx.scopedFile.count({ where: { uploadedById: userId } }),
      tx.feedback.count({ where: { senderId: userId } }),
      tx.marketRate.count({ where: { updatedById: userId } }),
    ]);
    return names.filter((_name, index) => counts[index] > 0);
  }

  private prismaErrorCode(error: unknown): string | undefined {
    if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }

  private async auditedTransaction<T>(actor: AuthenticatedUser, plan: AuditPlan<T>, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const result = await operation(tx);
      await this.audit.record({
        userId: actor.id,
        actorIdentifier: actor.id,
        action: plan.action,
        entity: plan.entity,
        entityId: typeof plan.entityId === 'function' ? plan.entityId(result) : plan.entityId,
        changes: plan.changes,
        correlationId: currentCorrelationId(),
      }, tx);
      return result;
    });
  }

  private dashboardCapabilities(role: Role): string[] {
    const shared = ['view_dashboard'];
    const byRole: Record<string, string[]> = {
      SUPER_ADMIN: [...shared, 'manage_parks', 'manage_users', 'manage_advertisements', 'manage_sms'],
      PARK_MANAGER: [...shared, 'manage_factories', 'view_gate_passes', 'approve_gate_passes', 'approve_requests', 'manage_announcements', 'moderate_advertisements', 'send_messages', 'view_reports'],
      FACTORY_OWNER: [...shared, 'create_gate_passes', 'edit_gate_passes', 'create_requests', 'create_advertisements', 'view_invoices'],
      SECURITY_GUARD: [...shared, 'verify_gate_passes', 'view_emergencies'],
      GOVERNMENT_OFFICIAL: [...shared, 'view_reports'],
      EMPLOYEE: shared,
    };
    return byRole[role] || shared;
  }

  private async assertAnnouncementAccess(user: AuthenticatedUser, announcement: { createdById: string; parkId: string | null }) {
    if (user.role === Role.SUPER_ADMIN) return;
    if (announcement.createdById === user.id) return;
    if (announcement.parkId && (await this.managedParkIds(user)).includes(announcement.parkId)) return;
    throw new ForbiddenException('You do not have access to this announcement');
  }

  private async assertParkScope(user: AuthenticatedUser, parkId: string): Promise<void> {
    if (user.role === Role.SUPER_ADMIN) return;
    const managedIds = await this.managedParkIds(user);
    if (!managedIds.includes(parkId)) throw new ForbiddenException('You do not have access to this park');
  }

  private async factoryIds(user: AuthenticatedUser): Promise<string[]> {
    const factories = await this.prisma.factory.findMany({ where: await this.factoryFilter(user), select: { id: true } });
    return factories.map((factory) => factory.id);
  }
  private async factoryFilter(user: AuthenticatedUser, db: FactoryScopeDatabase = this.prisma): Promise<Prisma.FactoryWhereInput> {
    if (user.role === Role.SUPER_ADMIN || user.role === Role.GOVERNMENT_OFFICIAL) return {};
    if (user.role === Role.FACTORY_OWNER) {
      // The guard only sets activeFactoryId after verifying ownership (X-Factory-Id header).
      // Callers spread this after their own `id`, so the id restriction must live inside AND.
      if (user.activeFactoryId) return { managerId: user.id, AND: [{ id: user.activeFactoryId }] };
      return { managerId: user.id };
    }
    if (user.role === Role.EMPLOYEE) {
      const employee = await db.user.findUnique({
        where: { id: user.id },
        select: { employeeOfFactoryId: true },
      });
      return { AND: [{ id: employee?.employeeOfFactoryId || '__none__' }] };
    }
    const parks = await db.industrialPark.findMany({
      where: user.role === Role.PARK_MANAGER
        ? { managers: { some: { id: user.id } } }
        : { securityGuards: { some: { userId: user.id, isActive: true } } },
      select: { id: true },
    });
    return { parkId: { in: parks.map((park) => park.id) } };
  }
  private async factoryRecord(user: AuthenticatedUser, factoryId: string, db: FactoryScopeDatabase): Promise<FactoryManagementRecord> {
    const item = await db.factory.findFirst({
      where: { id: factoryId, ...await this.factoryFilter(user, db) },
      select: FACTORY_MANAGEMENT_SELECT,
    });
    if (item) return item;
    if (user.role === Role.SUPER_ADMIN || user.role === Role.GOVERNMENT_OFFICIAL) throw new NotFoundException('Factory not found');
    throw new ForbiddenException('You do not have access to this factory');
  }

  private async assertFactoryRelations(actor: AuthenticatedUser, parkId: string, managerId: string, db: FactoryScopeDatabase): Promise<void> {
    const parkWhere: Prisma.IndustrialParkWhereInput = {
      id: parkId,
      status: ParkStatus.ACTIVE,
      ...(actor.role === Role.SUPER_ADMIN ? {} : { managers: { some: { id: actor.id } } }),
    };
    const [park, manager] = await Promise.all([
      db.industrialPark.findFirst({ where: parkWhere, select: { id: true } }),
      db.user.findFirst({
        where: { id: managerId, role: Role.FACTORY_OWNER, isActive: true, isApproved: true },
        select: { id: true },
      }),
    ]);
    if (!park) {
      if (actor.role === Role.SUPER_ADMIN) throw new BadRequestException('Factory park must exist and be active');
      throw new ForbiddenException('You do not have access to this active park');
    }
    if (!manager) throw new BadRequestException('Factory manager must be an active approved factory owner');
  }

  private async assertFactoryAccess(user: AuthenticatedUser, factoryId: string) {
    const allowed = await this.prisma.factory.count({ where: { id: factoryId, ...await this.factoryFilter(user) } });
    if (!allowed) throw new ForbiddenException('You do not have access to this factory');
  }

  /** Suspended units keep read access and may still pay their invoices, but cannot create new work. */
  private assertFactoryNotSuspended(factory: { status?: FactoryStatus | null; suspendedReason?: string | null } | null | undefined) {
    if (factory?.status === FactoryStatus.SUSPENDED) {
      const reason = factory.suspendedReason ? ` دلیل: ${factory.suspendedReason}` : '';
      throw new ForbiddenException(`این واحد صنعتی توسط مدیریت شهرک مسدود شده است.${reason}`);
    }
  }

  async setFactorySuspended(actor: AuthenticatedUser, id: string, suspended: boolean, reason?: string) {
    const factory = await this.prisma.factory.findFirst({
      where: { id, ...(await this.factoryFilter(actor)) },
      select: { id: true, name: true, status: true, isApproved: true, managerId: true, manager: { select: { phoneNumber: true } } },
    });
    if (!factory) throw new ForbiddenException('You do not have access to this factory');
    if (suspended && factory.status === FactoryStatus.SUSPENDED) throw new ConflictException('Factory is already suspended');
    if (suspended && factory.status !== FactoryStatus.ACTIVE && factory.status !== FactoryStatus.PENDING) {
      throw new ConflictException('Only active or pending factories can be suspended');
    }
    if (!suspended && factory.status !== FactoryStatus.SUSPENDED) throw new ConflictException('Factory is not suspended');
    const cleanReason = (reason || '').trim().slice(0, 2000);
    if (suspended && !cleanReason) throw new BadRequestException('A suspension reason is required');

    const updated = await this.prisma.factory.update({
      where: { id },
      data: suspended
        ? { status: FactoryStatus.SUSPENDED, suspendedReason: cleanReason, suspendedAt: new Date() }
        : { status: factory.isApproved ? FactoryStatus.ACTIVE : FactoryStatus.PENDING, suspendedReason: null, suspendedAt: null },
      select: { id: true, name: true, status: true, suspendedReason: true, suspendedAt: true, isApproved: true },
    });
    await this.audit.record({
      userId: actor.id,
      action: suspended ? 'FACTORY_SUSPENDED' : 'FACTORY_UNSUSPENDED',
      entity: 'Factory',
      entityId: id,
      changes: suspended ? { reason: cleanReason } : undefined,
    });
    const message = suspended
      ? `حساب واحد «${factory.name}» مسدود شد. دلیل: ${cleanReason}. پرداخت قبوض همچنان امکان‌پذیر است.`
      : `مسدودی حساب واحد «${factory.name}» برداشته شد.`;
    if (factory.managerId) await this.notifyUser(factory.managerId, suspended ? 'مسدودسازی واحد' : 'رفع مسدودی واحد', message, suspended ? 'WARNING' : 'SUCCESS');
    if (factory.manager?.phoneNumber) await this.safeSendSms(factory.manager.phoneNumber, `MEKSS: ${message}`);
    return updated;
  }

  private async assertOwnedFactory(actor: AuthenticatedUser, factoryId: string) {
    if (actor.role !== Role.FACTORY_OWNER) throw new ForbiddenException('Only factory owners can manage staff');
    const owned = await this.prisma.factory.count({ where: { id: factoryId, managerId: actor.id } });
    if (!owned) throw new ForbiddenException('You do not have access to this factory');
  }

  private async assertManagedParkAccess(actor: AuthenticatedUser, parkId: string) {
    if (actor.role === Role.SUPER_ADMIN) return;
    if (actor.role !== Role.PARK_MANAGER) throw new ForbiddenException('Only park managers can manage park staff');
    const managed = await this.managedParkIds(actor);
    if (!managed.includes(parkId)) throw new ForbiddenException('You do not have access to this park');
  }

  private async resolveParkStaffParkId(actor: AuthenticatedUser, requestedParkId?: string): Promise<string> {
    if (actor.role === Role.SUPER_ADMIN) {
      if (!requestedParkId) throw new BadRequestException('parkId is required');
      const park = await this.prisma.industrialPark.findUnique({ where: { id: requestedParkId }, select: { id: true } });
      if (!park) throw new NotFoundException('Park not found');
      return park.id;
    }
    if (actor.role !== Role.PARK_MANAGER) throw new ForbiddenException('Only park managers can manage park staff');
    const managed = await this.managedParkIds(actor);
    if (!managed.length) throw new ForbiddenException('No managed park assigned');
    if (requestedParkId) {
      if (!managed.includes(requestedParkId)) throw new ForbiddenException('You do not have access to this park');
      return requestedParkId;
    }
    if (managed.length === 1) return managed[0];
    throw new BadRequestException('parkId is required when multiple parks are assigned');
  }

  private async resolveParkStaffScope(actor: AuthenticatedUser, parkId?: string): Promise<string[]> {
    if (actor.role === Role.SUPER_ADMIN) {
      if (parkId) {
        const park = await this.prisma.industrialPark.findUnique({ where: { id: parkId }, select: { id: true } });
        if (!park) throw new NotFoundException('Park not found');
        return [park.id];
      }
      return this.prisma.industrialPark.findMany({ select: { id: true } }).then((rows) => rows.map((row) => row.id));
    }
    if (actor.role !== Role.PARK_MANAGER) throw new ForbiddenException('Only park managers can manage park staff');
    const managed = await this.managedParkIds(actor);
    if (parkId) {
      if (!managed.includes(parkId)) throw new ForbiddenException('You do not have access to this park');
      return [parkId];
    }
    return managed;
  }

  private async assertRequestActionAccess(
    actor: AuthenticatedUser,
    request: { factoryId: string; type: RequestType; isToParkManager: boolean },
  ) {
    if (actor.role === Role.SUPER_ADMIN) return;

    if (request.isToParkManager) {
      if (actor.role !== Role.PARK_MANAGER) {
        throw new ForbiddenException('Only park managers can decide park-level requests');
      }
      await this.assertFactoryAccess(actor, request.factoryId);
      return;
    }

    if (actor.role === Role.FACTORY_OWNER) {
      const owned = await this.prisma.factory.count({ where: { id: request.factoryId, managerId: actor.id } });
      if (!owned) throw new ForbiddenException('You do not have access to this request');
      return;
    }

    if (actor.role === Role.EMPLOYEE) {
      const employee = await this.prisma.user.findUnique({
        where: { id: actor.id },
        select: { employeeOfFactoryId: true, canApproveRequestTypes: true, isActive: true },
      });
      if (!employee?.isActive || employee.employeeOfFactoryId !== request.factoryId) {
        throw new ForbiddenException('You do not have access to this request');
      }
      if (!employee.canApproveRequestTypes.includes(request.type)) {
        throw new ForbiddenException('You are not permitted to approve this request type');
      }
      return;
    }

    if (actor.role === Role.PARK_MANAGER) {
      throw new ForbiddenException('Park managers can only decide park-level requests');
    }

    throw new ForbiddenException('You do not have permission to decide this request');
  }

  private async actorParkIds(actor: AuthenticatedUser): Promise<string[]> {
    if (actor.role === Role.FACTORY_OWNER) {
      const factories = await this.prisma.factory.findMany({
        where: actor.activeFactoryId ? { managerId: actor.id, id: actor.activeFactoryId } : { managerId: actor.id },
        select: { parkId: true },
      });
      return [...new Set(factories.map((factory) => factory.parkId))];
    }
    if (actor.role === Role.EMPLOYEE) {
      const employee = await this.prisma.user.findUnique({
        where: { id: actor.id },
        select: {
          employeeOfFactory: { select: { parkId: true } },
          employeeOfParkId: true,
        },
      });
      if (employee?.employeeOfParkId) return [employee.employeeOfParkId];
      return employee?.employeeOfFactory?.parkId ? [employee.employeeOfFactory.parkId] : [];
    }
    if (actor.role === Role.SECURITY_GUARD) {
      const assignments = await this.prisma.securityGuard.findMany({
        where: { userId: actor.id, isActive: true },
        select: { parkId: true },
      });
      return [...new Set(assignments.map((row) => row.parkId))];
    }
    return this.managedParkIds(actor);
  }

  private async resolveEmergencyParkId(actor: AuthenticatedUser, requestedParkId?: string): Promise<string> {
    if (actor.role === Role.SUPER_ADMIN) {
      if (!requestedParkId) throw new BadRequestException('parkId is required for super-admin emergency alerts');
      const park = await this.prisma.industrialPark.findUnique({ where: { id: requestedParkId }, select: { id: true } });
      if (!park) throw new NotFoundException('Park not found');
      return park.id;
    }

    const parkIds = await this.actorParkIds(actor);
    if (!parkIds.length) throw new ForbiddenException('No park assignment found for emergency alerts');

    if (requestedParkId) {
      if (!parkIds.includes(requestedParkId)) throw new ForbiddenException('You do not have access to this park');
      return requestedParkId;
    }

    if (parkIds.length === 1) return parkIds[0];
    throw new BadRequestException('parkId is required when multiple parks are assigned');
  }

  private async emergencyScopeWhere(actor: AuthenticatedUser): Promise<Prisma.EmergencyAlertWhereInput> {
    if (actor.role === Role.SUPER_ADMIN || actor.role === Role.GOVERNMENT_OFFICIAL) return {};
    const parkIds = await this.actorParkIds(actor);
    if (!parkIds.length) return { id: { in: [] } };
    return { parkId: { in: parkIds } };
  }

  private async assertEmergencyAccess(actor: AuthenticatedUser, alert: { parkId: string | null; createdById: string }) {
    if (actor.role === Role.SUPER_ADMIN) return;
    if (alert.createdById === actor.id) return;
    if (!alert.parkId) throw new ForbiddenException('You do not have access to this emergency alert');
    const parkIds = await this.actorParkIds(actor);
    if (!parkIds.includes(alert.parkId)) throw new ForbiddenException('You do not have access to this emergency alert');
  }

  private async emergencyRecipients(parkId: string | null): Promise<{ userIds: string[]; phones: string[] }> {
    if (!parkId) return { userIds: [], phones: [] };

    const [managers, factories, guards, park] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: Role.PARK_MANAGER, isActive: true, isApproved: true, managedParks: { some: { id: parkId } } },
        select: { id: true, phoneNumber: true },
      }),
      this.prisma.factory.findMany({
        where: { parkId, isApproved: true },
        select: {
          id: true,
          managerId: true,
          manager: { select: { id: true, phoneNumber: true, isActive: true, isApproved: true } },
        },
      }),
      this.prisma.securityGuard.findMany({
        where: { parkId, isActive: true },
        select: {
          user: { select: { id: true, phoneNumber: true, isActive: true, isApproved: true } },
        },
      }),
      this.prisma.industrialPark.findUnique({
        where: { id: parkId },
        select: { guardPhone: true, phoneNumber: true },
      }),
    ]);

    const factoryIds = factories.map((factory) => factory.id).filter(Boolean);
    const employees = factoryIds.length
      ? await this.prisma.user.findMany({
        where: {
          role: Role.EMPLOYEE,
          employeeOfFactoryId: { in: factoryIds },
          isActive: true,
          isApproved: true,
        },
        select: { id: true, phoneNumber: true },
      })
      : [];

    const userMap = new Map<string, string>();
    const addUser = (id?: string | null, phone?: string | null, active = true, approved = true) => {
      if (!id || !active || !approved) return;
      userMap.set(id, phone || '');
    };

    for (const manager of managers) addUser(manager.id, manager.phoneNumber);
    for (const factory of factories) {
      addUser(
        factory.manager?.id || factory.managerId,
        factory.manager?.phoneNumber,
        factory.manager?.isActive !== false,
        factory.manager?.isApproved !== false,
      );
    }
    for (const guard of guards) {
      addUser(guard.user?.id, guard.user?.phoneNumber, guard.user?.isActive !== false, guard.user?.isApproved !== false);
    }
    for (const employee of employees) addUser(employee.id, employee.phoneNumber);
    const parkEmployees = await this.prisma.user.findMany({
      where: {
        role: Role.EMPLOYEE,
        employeeOfParkId: parkId,
        employeeOfFactoryId: null,
        isActive: true,
        isApproved: true,
      },
      select: { id: true, phoneNumber: true },
    });
    for (const employee of parkEmployees || []) addUser(employee.id, employee.phoneNumber);

    const phones = new Set<string>();
    for (const phone of userMap.values()) {
      if (phone) phones.add(phone);
    }
    if (park?.guardPhone) phones.add(park.guardPhone);
    if (park?.phoneNumber) phones.add(park.phoneNumber);

    return { userIds: [...userMap.keys()], phones: [...phones] };
  }

  private async emergencyNotifyPhones(actor: AuthenticatedUser): Promise<string[]> {
    const parkIds = actor.role === Role.SUPER_ADMIN
      ? (await this.prisma.industrialPark.findMany({
        where: { status: ParkStatus.ACTIVE },
        select: { id: true },
        take: 50,
      })).map((park) => park.id)
      : await this.actorParkIds(actor);

    const phones = new Set<string>();
    for (const parkId of parkIds) {
      const recipients = await this.emergencyRecipients(parkId);
      for (const phone of recipients.phones) phones.add(phone);
    }
    phones.delete(actor.phoneNumber);
    return [...phones];
  }

  private async ensureMarketRatesSeeded() {
    const count = await this.prisma.marketRate.count();
    if (count > 0) return;
    await this.prisma.marketRate.createMany({
      data: (Object.keys(MARKET_RATE_DEFAULTS) as MarketRateKey[]).map((key) => ({
        key,
        label: MARKET_RATE_DEFAULTS[key].label,
        value: MARKET_RATE_DEFAULTS[key].value,
        unit: MARKET_RATE_DEFAULTS[key].unit,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Texts a newly created (or password-reset) staff member how to sign in.
   * The password itself is never sent: SMS content passes through the provider and its logs.
   */
  private async sendStaffCredentialsSms(
    staff: { phoneNumber: string; username?: string | null },
    organization: string | null,
    kind: 'created' | 'password-reset' = 'created',
  ) {
    const frontendUrl = (this.config.get<string>('FRONTEND_URL') || '').trim().replace(/\/+$/, '');
    const loginHint = frontendUrl && !/localhost|127\.0\.0\.1/.test(frontendUrl) ? ` ورود: ${frontendUrl}/login` : '';
    const username = staff.username || staff.phoneNumber;
    const where = organization ? ` در ${organization}` : '';
    const intro = kind === 'created'
      ? `اطلاعات کاربری شما${where} در سامانه MEKSS ثبت شد.`
      : `رمز عبور شما${where} در سامانه MEKSS بازنشانی شد.`;
    await this.safeSendSms(
      staff.phoneNumber,
      `${intro} نام کاربری: ${username} — رمز عبور را از مدیر خود دریافت کنید یا در صفحه ورود از «فراموشی رمز عبور» رمز موقت بگیرید و پس از ورود آن را تغییر دهید.${loginHint}`,
    );
  }

  private async safeSendSms(phoneNumber: string, message: string) {
    try {
      await this.sms.sendText(phoneNumber, message);
    } catch (error) {
      this.logger.warn(`SMS delivery failed for ${phoneNumber.slice(0, 4)}***: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private async notifyUser(
    userId: string,
    title: string,
    body: string,
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'EMERGENCY' = 'INFO',
  ) {
    try {
      await this.prisma.notification.create({
        data: { userId, title, body, type },
      });
    } catch (error) {
      this.logger.warn(`Notification create failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private async announcementVisibilityOr(actor: AuthenticatedUser): Promise<Prisma.AnnouncementWhereInput[]> {
    const scope: Prisma.AnnouncementWhereInput[] = [
      { isGlobal: true },
      { createdById: actor.id },
    ];
    const parkIds = await this.actorParkIds(actor);

    if (actor.role === Role.PARK_MANAGER) {
      // Park managers see every announcement in parks they manage (park-wide + unit-scoped).
      if (parkIds.length) scope.push({ parkId: { in: parkIds } });
      return scope;
    }

    if (actor.role === Role.SECURITY_GUARD) {
      // Guards only receive park-wide announcements (not unit-only ones).
      if (parkIds.length) {
        scope.push({ parkId: { in: parkIds }, factoryId: null, isGlobal: false });
      }
      return scope;
    }

    if (actor.role === Role.FACTORY_OWNER) {
      const factories = await this.prisma.factory.findMany({
        where: { managerId: actor.id },
        select: { id: true, parkId: true },
      });
      const factoryIds = factories.map((f) => f.id);
      const ownerParkIds = [...new Set(factories.map((f) => f.parkId))];
      // Park-wide (managers + guards tier) + announcements aimed at their unit(s).
      if (ownerParkIds.length) {
        scope.push({ parkId: { in: ownerParkIds }, factoryId: null, isGlobal: false });
      }
      if (factoryIds.length) {
        scope.push({ factoryId: { in: factoryIds } });
      }
      return scope;
    }

    if (actor.role === Role.EMPLOYEE) {
      const me = await this.prisma.user.findUnique({
        where: { id: actor.id },
        select: {
          employeeOfFactoryId: true,
          employeeOfParkId: true,
          employeeOfFactory: { select: { parkId: true } },
        },
      });
      // Employees only see unit-scoped announcements for their factory (not park-wide).
      if (me?.employeeOfFactoryId) {
        scope.push({ factoryId: me.employeeOfFactoryId });
      }
      return scope;
    }

    // Fallback: global + own only.
    return scope;
  }

  private async announcementRecipients(
    actor: AuthenticatedUser,
    parkId: string | null,
    factoryId: string | null,
    isGlobal: boolean,
  ): Promise<string[]> {
    // Only true global announcements fan out to the entire platform.
    if (isGlobal) {
      const users = await this.prisma.user.findMany({
        where: { isActive: true, isApproved: true, id: { not: actor.id } },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    // One industrial unit: manager + employees of that factory.
    if (factoryId) {
      return this.factoryUnitMessagingAudienceIds(factoryId, actor.id);
    }
    // Park-wide: factory managers + active security guards (not every employee).
    if (parkId) {
      return this.parkMessagingAudienceIds([parkId], actor.id);
    }
    return [];
  }

  async pendingRegistrations(actor: AuthenticatedUser) {
    if (actor.role === Role.SUPER_ADMIN) {
      return this.prisma.user.findMany({
        where: { isApproved: false, isActive: true, role: { in: [Role.FACTORY_OWNER, Role.EMPLOYEE] } },
        select: {
          id: true, name: true, phoneNumber: true, role: true, createdAt: true,
          requestedParkId: true,
          requestedPark: { select: { id: true, name: true } },
          employeeOfFactoryId: true,
          employeeOfFactory: { select: { id: true, name: true, parkId: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (actor.role === Role.PARK_MANAGER) {
      const parkIds = await this.managedParkIds(actor);
      return this.prisma.user.findMany({
        where: {
          isApproved: false,
          isActive: true,
          role: Role.FACTORY_OWNER,
          requestedParkId: { in: parkIds },
        },
        select: {
          id: true, name: true, phoneNumber: true, role: true, createdAt: true,
          requestedParkId: true,
          requestedPark: { select: { id: true, name: true } },
          employeeOfFactoryId: true,
          employeeOfFactory: { select: { id: true, name: true, parkId: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (actor.role === Role.FACTORY_OWNER) {
      const factories = await this.prisma.factory.findMany({
        where: { managerId: actor.id },
        select: { id: true },
      });
      const factoryIds = factories.map((f) => f.id);
      return this.prisma.user.findMany({
        where: {
          isApproved: false,
          isActive: true,
          role: Role.EMPLOYEE,
          employeeOfFactoryId: { in: factoryIds },
        },
        select: {
          id: true, name: true, phoneNumber: true, role: true, createdAt: true,
          requestedParkId: true,
          requestedPark: { select: { id: true, name: true } },
          employeeOfFactoryId: true,
          employeeOfFactory: { select: { id: true, name: true, parkId: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
    return [];
  }

  async decideRegistration(
    actor: AuthenticatedUser,
    userId: string,
    approved: boolean,
    reason?: string,
    canApproveRequestTypes?: RequestType[],
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, role: true, isApproved: true, phoneNumber: true, name: true,
        requestedParkId: true, employeeOfFactoryId: true,
        employeeOfFactory: { select: { managerId: true, parkId: true } },
      },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.isApproved) throw new ConflictException('Registration was already decided');

    if (actor.role === Role.PARK_MANAGER) {
      if (target.role !== Role.FACTORY_OWNER || !target.requestedParkId) {
        throw new ForbiddenException('Park managers can only approve factory-owner registrations for their parks');
      }
      await this.assertParkScope(actor, target.requestedParkId);
    } else if (actor.role === Role.FACTORY_OWNER) {
      if (target.role !== Role.EMPLOYEE || !target.employeeOfFactoryId) {
        throw new ForbiddenException('Factory owners can only approve their employees');
      }
      if (target.employeeOfFactory?.managerId !== actor.id) {
        throw new ForbiddenException('Employee does not belong to your factory');
      }
    } else if (actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Not allowed');
    }

    if (!approved && !reason?.trim()) throw new BadRequestException('A reason is required');

    if (approved) {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          isApproved: true,
          ...(target.role === Role.EMPLOYEE && canApproveRequestTypes?.length
            ? { canApproveRequestTypes }
            : {}),
        },
      });
      if (target.role === Role.FACTORY_OWNER) {
        await this.prisma.factory.updateMany({
          where: { managerId: userId, status: FactoryStatus.PENDING, isApproved: false },
          data: {
            status: FactoryStatus.ACTIVE,
            isApproved: true,
            reviewedById: actor.id,
            reviewedAt: new Date(),
            rejectionReason: null,
          },
        });
      }
      await this.audit.record({ userId: actor.id, action: 'REGISTRATION_APPROVED', entity: 'User', entityId: userId });
      await this.notifyUser(userId, 'تایید ثبت‌نام', 'حساب کاربری شما تایید شد و می‌توانید وارد سامانه شوید.', 'SUCCESS');
      if (target.phoneNumber) {
        await this.safeSendSms(
          target.phoneNumber,
          `کاربر گرامی مدیر واحد صنعتی ${target.name} کاربری شما در مکص توسط مدیر شهرک صنعتی مربوطه تایید گردید`,
        );
      }
      return updated;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false, sessionVersion: { increment: 1 } },
    });
    if (target.role === Role.FACTORY_OWNER) {
      await this.prisma.factory.updateMany({
        where: { managerId: userId, status: FactoryStatus.PENDING, isApproved: false },
        data: {
          status: FactoryStatus.INACTIVE,
          isApproved: false,
          rejectionReason: reason?.trim() || 'رد ثبت‌نام',
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
      });
    }
    await this.audit.record({
      userId: actor.id,
      action: 'REGISTRATION_REJECTED',
      entity: 'User',
      entityId: userId,
      changes: { reason: reason?.trim() },
    });
    if (target.phoneNumber) {
      await this.safeSendSms(
        target.phoneNumber,
        `کاربر گرامی مدیر واحد صنعتی ${target.name} کاربری شما در مکص توسط مدیر شهرک صنعتی مربوطه عدم تایید گردید`,
      );
    }
    return { id: userId, rejected: true };
  }

  private parseMarketNumber(raw: unknown): number | null {
    if (raw == null) return null;
    if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : null;
    const cleaned = String(raw).replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
    const value = Number(cleaned);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  private async fetchTgjuAjax(): Promise<Record<string, { p?: string | number }>> {
    const hosts = [
      'https://call5.tgju.org/ajax.json',
      'https://call3.tgju.org/ajax.json',
      'https://call1.tgju.org/ajax.json',
    ];
    for (const url of hosts) {
      try {
        const res = await fetch(url, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'MEKSS-MarketRates/1.0',
          },
        });
        if (!res.ok) continue;
        const body = await res.json() as { current?: Record<string, { p?: string | number }> };
        if (body?.current && typeof body.current === 'object') return body.current;
      } catch {
        /* try next host */
      }
    }
    return {};
  }

  private async refreshMarketRatesFromProviders(updatedById?: string): Promise<number> {
    const quotes: Partial<Record<MarketRateKey, number>> = {};

    // Primary source: TGJU live board (Iranian market prices in Rial).
    try {
      const current = await this.fetchTgjuAjax();
      const pick = (...keys: string[]) => {
        for (const key of keys) {
          const value = this.parseMarketNumber(current[key]?.p);
          if (value != null) return value;
        }
        return null;
      };

      const usd = pick('price_dollar_rl', 'price_dollar_dt');
      const eur = pick('price_eur');
      const cny = pick('price_cny');
      const gold = pick('geram18');
      const coin = pick('sekee', 'retail_sekee');
      const silver = pick('silver_999', 'silver_925');
      const usdt = pick('crypto-tether-irr');
      const btc = pick('crypto-bitcoin-irr');
      const eth = pick('crypto-ethereum-irr');
      const oil = pick('oil_brent');
      const copperUsdTon = pick('copper', 'base_global_copper');
      const aluminumUsdTon = pick('base-us-aluminum');
      const ironUsdTon = pick('base_global_iron_ore', 'base-us-iron-ore');
      const bitumen = pick('commodity_bitumen');
      const platinumUsdOz = pick('platinum');

      if (usd) quotes.USD = Math.round(usd);
      if (eur) quotes.EUR = Math.round(eur);
      if (cny) quotes.CNY = Math.round(cny);
      if (gold) quotes.GOLD = Math.round(gold);
      if (coin) quotes.COIN = Math.round(coin);
      if (silver) quotes.SILVER = Math.round(silver);
      if (usdt) quotes.USDT = Math.round(usdt);
      if (btc) quotes.BTC = Math.round(btc);
      if (eth) quotes.ETH = Math.round(eth);
      if (oil) quotes.OIL = Number(oil);
      // TGJU bitumen index is often a small commodity index; only trust large Rial-like values.
      if (bitumen && bitumen >= 100_000) quotes.BITUMEN = Math.round(bitumen);

      const usdIrr = quotes.USD || 0;
      if (usdIrr > 0) {
        if (copperUsdTon) quotes.COPPER = Math.round((copperUsdTon / 1000) * usdIrr);
        if (aluminumUsdTon) quotes.ALUMINUM = Math.round((aluminumUsdTon / 1000) * usdIrr);
        if (ironUsdTon) quotes.IRON = Math.round((ironUsdTon / 1000) * usdIrr);
        if (platinumUsdOz) quotes.PLATINUM = Math.round((platinumUsdOz / 31.1035) * usdIrr);
        if (bitumen && bitumen < 100_000) quotes.BITUMEN = Math.round((bitumen / 1000) * usdIrr);
      }
    } catch {
      /* continue with fallbacks */
    }

    // Crypto fallback via CoinGecko (USD) × USD/IRR when TGJU crypto keys are missing.
    if (!quotes.USDT || !quotes.BTC || !quotes.ETH) {
      try {
        const cgRes = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=tether,bitcoin,ethereum&vs_currencies=usd',
        );
        if (cgRes.ok) {
          const cg = await cgRes.json() as Record<string, { usd?: number }>;
          const existingUsd = await this.prisma.marketRate.findUnique({ where: { key: MarketRateKey.USD } });
          const usdIrr = quotes.USD
            || this.parseMarketNumber(existingUsd?.value != null ? String(existingUsd.value) : null)
            || 0;
          if (usdIrr > 0) {
            if (!quotes.USDT && cg.tether?.usd) quotes.USDT = Math.round(cg.tether.usd * usdIrr);
            if (!quotes.BTC && cg.bitcoin?.usd) quotes.BTC = Math.round(cg.bitcoin.usd * usdIrr);
            if (!quotes.ETH && cg.ethereum?.usd) quotes.ETH = Math.round(cg.ethereum.usd * usdIrr);
          }
        }
      } catch { /* ignore */ }
    }

    // Secondary FX fallback if TGJU was unreachable.
    if (!quotes.USD || !quotes.EUR || !quotes.CNY) {
      try {
        const fxRes = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,CNY');
        if (fxRes.ok) {
          const fx = await fxRes.json() as { rates?: Record<string, number> };
          const existingUsd = await this.prisma.marketRate.findUnique({ where: { key: MarketRateKey.USD } });
          const usdIrr = quotes.USD
            || (Number(existingUsd?.value) > 0 ? Number(existingUsd!.value) : 0);
          if (usdIrr > 0) {
            quotes.USD = Math.round(usdIrr);
            if (!quotes.EUR && fx.rates?.EUR) quotes.EUR = Math.round(usdIrr / fx.rates.EUR);
            if (!quotes.CNY && fx.rates?.CNY) quotes.CNY = Math.round(usdIrr / fx.rates.CNY);
          }
        }
      } catch { /* ignore */ }
    }

    if (quotes.COPPER && !quotes.ALUMINUM) quotes.ALUMINUM = Math.round(quotes.COPPER * 0.55);
    if (quotes.COPPER && !quotes.IRON) quotes.IRON = Math.round(quotes.COPPER * 0.12);
    if (quotes.GOLD && !quotes.COIN) quotes.COIN = Math.round(quotes.GOLD * 8.13);
    if (quotes.IRON && !quotes.BITUMEN) quotes.BITUMEN = Math.round(quotes.IRON * 0.8);
    if (quotes.USD && !quotes.USDT) quotes.USDT = quotes.USD;

    let updated = 0;
    for (const key of Object.keys(quotes) as MarketRateKey[]) {
      const value = quotes[key];
      if (!value || !Number.isFinite(value) || value <= 0) continue;
      try {
        const row = await this.prisma.marketRate.upsert({
          where: { key },
          create: {
            key,
            label: MARKET_RATE_DEFAULTS[key].label,
            unit: MARKET_RATE_DEFAULTS[key].unit,
            value,
            updatedById: updatedById || null,
          },
          update: {
            value,
            label: MARKET_RATE_DEFAULTS[key].label,
            unit: MARKET_RATE_DEFAULTS[key].unit,
            updatedById: updatedById || null,
          },
        });
        await this.prisma.marketRateHistory.create({
          data: { key, value, marketRateId: row.id },
        });
        updated += 1;
      } catch { /* skip individual key */ }
    }
    return updated;
  }

  private paymentResponse(authority: string, paymentUrl?: string) { const callback = this.config.get<string>('ZARINPAL_CALLBACK_URL') || 'http://localhost:3000/api/v1/invoices/payment/callback'; return { authority, paymentUrl: paymentUrl || `${callback}?Authority=${authority}&Status=OK` }; }
  private text(value: unknown, field: string) { if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} is required`); }

  /** Calendar days past dueDate (UTC date-only). Due day itself is not late. */
  private calendarDaysLate(dueDate: Date, asOf: Date = new Date()): number {
    return calendarDaysLate(dueDate, asOf);
  }

  private money(value: number): number {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  private computeInvoiceSettlement(invoice: {
    amount: Prisma.Decimal | number;
    taxAmount: Prisma.Decimal | number;
    totalAmount: Prisma.Decimal | number;
    latePenaltyPerDay?: Prisma.Decimal | number | null;
    lateDays?: number | null;
    latePenaltyAmount?: Prisma.Decimal | number | null;
    dueDate: Date;
    penaltyStartsAt?: Date | null;
    discountAmount?: Prisma.Decimal | number | null;
    status: InvoiceStatus;
    paymentDate?: Date | null;
  }, asOf: Date = new Date()) {
    const baseTotal = this.money(Number(invoice.totalAmount));
    const latePenaltyPerDay = this.money(Number(invoice.latePenaltyPerDay || 0));
    const isPaid = invoice.status === InvoiceStatus.PAID;
    const isAwaitingConfirm = invoice.status === InvoiceStatus.AWAITING_CONFIRMATION;
    const lateFrozen = isPaid || isAwaitingConfirm || invoice.status === InvoiceStatus.INSTALLMENTS;

    let lateDays: number;
    let latePenaltyAmount: number;
    if (lateFrozen) {
      lateDays = Math.max(0, Number(invoice.lateDays ?? 0));
      latePenaltyAmount = this.money(Number(invoice.latePenaltyAmount || 0));
    } else if (invoice.status === InvoiceStatus.CANCELLED) {
      lateDays = 0;
      latePenaltyAmount = 0;
    } else {
      // An extended due date keeps the original penalty start (penaltyStartsAt).
      lateDays = this.calendarDaysLate(invoice.penaltyStartsAt ?? invoice.dueDate, asOf);
      latePenaltyAmount = this.money(lateDays * latePenaltyPerDay);
    }

    let status = invoice.status;
    if (status === InvoiceStatus.PENDING && this.calendarDaysLate(invoice.dueDate, asOf) > 0) {
      status = InvoiceStatus.OVERDUE;
    }

    return {
      baseAmount: this.money(Number(invoice.amount)),
      taxAmount: this.money(Number(invoice.taxAmount)),
      discountAmount: this.money(Number(invoice.discountAmount || 0)),
      baseTotal,
      latePenaltyPerDay,
      lateDays,
      latePenaltyAmount,
      payableAmount: this.money(baseTotal + latePenaltyAmount),
      status,
    };
  }

  private async invoiceListWhere(
    user: AuthenticatedUser,
    scope: 'payable' | 'managed',
  ): Promise<Prisma.InvoiceWhereInput> {
    if (scope === 'payable') {
      if (user.role === Role.FACTORY_OWNER) {
        return {
          targetType: InvoiceTarget.FACTORY,
          factoryId: { in: await this.factoryIds(user) },
        };
      }
      if (user.role === Role.PARK_MANAGER) {
        return {
          targetType: InvoiceTarget.PARK,
          parkId: { in: await this.managedParkIds(user) },
        };
      }
      if (user.role === Role.SUPER_ADMIN) {
        // Super-admin has no personal park debt feed; empty payable set.
        return { id: { in: [] } };
      }
      return { id: { in: [] } };
    }

    // managed = factory AR the actor collects / audits
    if (user.role === Role.FACTORY_OWNER) {
      return {
        targetType: InvoiceTarget.FACTORY,
        factoryId: { in: await this.factoryIds(user) },
      };
    }
    if (user.role === Role.PARK_MANAGER || user.role === Role.SUPER_ADMIN || user.role === Role.GOVERNMENT_OFFICIAL) {
      // Super admin also issues/collects platform invoices addressed to parks.
      if (user.role === Role.SUPER_ADMIN) return {};
      if (user.role === Role.GOVERNMENT_OFFICIAL) {
        return { targetType: InvoiceTarget.FACTORY };
      }
      const factoryIds = await this.factoryIds(user);
      return {
        targetType: InvoiceTarget.FACTORY,
        factoryId: { in: factoryIds.length ? factoryIds : ['__none__'] },
      };
    }
    return { id: { in: [] } };
  }

  /**
   * Inclusive range filter. Date-only values (`YYYY-MM-DD`) are whole Tehran calendar days (fixed +03:30, no DST);
   * values that already carry a time are used as-is.
   */
  private dateRangeFilter(fromDate?: string, toDate?: string): { gte?: Date; lte?: Date } {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
    const bound = (value: string, time: string) => new Date(dateOnly.test(value) ? `${value}T${time}+03:30` : value);
    return {
      ...(fromDate ? { gte: bound(fromDate, '00:00:00.000') } : {}),
      ...(toDate ? { lte: bound(toDate, '23:59:59.999') } : {}),
    };
  }

  private messageSearchWhere(query: { search?: string; subject?: string; fromDate?: string; toDate?: string }): Prisma.MessageWhereInput {
    const where: Prisma.MessageWhereInput = {};
    if (query.fromDate || query.toDate) where.createdAt = this.dateRangeFilter(query.fromDate, query.toDate);
    const term = (query.search || query.subject || '').trim();
    if (term) {
      where.OR = [
        { subject: { contains: term, mode: 'insensitive' } },
        { body: { contains: term, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private async notifyRequestCreated(
    actor: AuthenticatedUser,
    request: { id: string; type: RequestType; title: string; isToParkManager: boolean; factoryId: string },
    factory: { id: string; name: string; parkId: string; managerId: string | null },
  ) {
    const typeLabel = REQUEST_TYPE_FA[request.type] || request.type;
    const creator = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { name: true } });
    const smsLine = `کاربر گرامی، یک درخواست ${typeLabel} توسط ${creator?.name || 'کاربر'} در سامانه مکص برای واحد صنعتی ${factory.name} ثبت گردیده است.`;
    const phones = new Set<string>();

    if (request.isToParkManager) {
      const parkManagers = await this.prisma.user.findMany({
        where: {
          role: Role.PARK_MANAGER,
          isActive: true,
          isApproved: true,
          managedParks: { some: { id: factory.parkId } },
        },
        select: { phoneNumber: true, name: true },
      });
      for (const manager of parkManagers) {
        if (manager.phoneNumber) phones.add(manager.phoneNumber);
      }
    } else if (factory.managerId && factory.managerId !== actor.id) {
      const manager = await this.prisma.user.findUnique({
        where: { id: factory.managerId },
        select: { phoneNumber: true },
      });
      if (manager?.phoneNumber) phones.add(manager.phoneNumber);
      const approvers = await this.prisma.user.findMany({
        where: {
          employeeOfFactoryId: factory.id,
          role: Role.EMPLOYEE,
          isActive: true,
          isApproved: true,
          canApproveRequestTypes: { has: request.type },
        },
        select: { phoneNumber: true },
      });
      for (const approver of approvers) {
        if (approver.phoneNumber) phones.add(approver.phoneNumber);
      }
    } else if (factory.managerId) {
      const approvers = await this.prisma.user.findMany({
        where: {
          employeeOfFactoryId: factory.id,
          role: Role.EMPLOYEE,
          isActive: true,
          isApproved: true,
          canApproveRequestTypes: { has: request.type },
        },
        select: { phoneNumber: true },
      });
      for (const approver of approvers) {
        if (approver.phoneNumber) phones.add(approver.phoneNumber);
      }
    }

    await Promise.all([...phones].map((phone) => this.safeSendSms(phone, smsLine)));
  }

  private async createPublicSmsGatePassRequest(input: PublicSmsRequestDto, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber: input.phoneNumber },
      select: {
        id: true,
        name: true,
        isActive: true,
        isApproved: true,
        role: true,
        employeeOfFactoryId: true,
        managedFactories: { select: { id: true, name: true }, orderBy: { createdAt: 'asc' }, take: 1 },
      },
    });
    if (!user?.isActive || !user.isApproved) throw new BadRequestException('No eligible account found for this phone number');
    const factory = user.role === Role.FACTORY_OWNER
      ? user.managedFactories[0]
      : null;
    const factoryId = factory?.id || user.employeeOfFactoryId;
    if (!factoryId) throw new BadRequestException('No factory is linked to this phone number');

    if (code === '92') {
      const [pending, approved] = await Promise.all([
        this.prisma.gatePass.count({ where: { factoryId, status: GatePassStatus.PENDING } }),
        this.prisma.gatePass.count({ where: { factoryId, status: GatePassStatus.APPROVED } }),
      ]);
      await this.safeSendSms(
        input.phoneNumber,
        `MEKSS برگ خروج: ${pending} در انتظار تایید، ${approved} آماده خروج. برای صدور جدید کد 91 را ارسال کنید.`,
      );
      return { ok: true, kind: 'gate_pass_query', pending, approved };
    }

    const factoryState = await this.prisma.factory.findUnique({ where: { id: factoryId }, select: { status: true, suspendedReason: true } });
    try {
      this.assertFactoryNotSuspended(factoryState);
    } catch (error) {
      await this.safeSendSms(input.phoneNumber, 'MEKSS: این واحد صنعتی مسدود است و امکان ثبت درخواست برگ خروج وجود ندارد.');
      throw error;
    }

    const title = 'درخواست صدور برگ خروج (پیامک)';
    const description = input.text?.trim() || 'درخواست خودکار صدور برگ خروج از طریق پیامک (کد 91)';
    const request = await this.prisma.request.create({
      data: {
        factoryId,
        type: RequestType.OTHER,
        title,
        description,
        data: { source: 'sms', channel: 'gate_pass', code, text: input.text ?? null },
        attachments: [],
        priority: 'HIGH',
        isToParkManager: false,
        creatorId: user.id,
        status: RequestStatus.PENDING,
      },
    });
    const factoryName = factory?.name || 'واحد صنعتی';
    if (user.role === Role.FACTORY_OWNER && user.managedFactories[0]) {
      const managerPhone = input.phoneNumber;
      await this.safeSendSms(
        managerPhone,
        `MEKSS: درخواست برگ خروج برای ${factoryName} ثبت شد. برای تکمیل جزئیات از اپلیکیشن استفاده کنید.`,
      );
    }
    return { ok: true, requestId: request.id, kind: 'gate_pass_issue' };
  }

  private async assertInvoiceAccess(
    actor: AuthenticatedUser,
    invoice: { targetType?: string | null; factoryId?: string | null; parkId?: string | null },
    mode: 'manage' | 'pay' | 'view',
  ) {
    const target = invoice.targetType || InvoiceTarget.FACTORY;
    if (target === InvoiceTarget.PARK) {
      if (!invoice.parkId) throw new ForbiddenException('Park invoice is missing park scope');
      if (mode === 'manage') {
        if (actor.role !== Role.SUPER_ADMIN) {
          throw new ForbiddenException('Only super admins can manage park invoices');
        }
        return;
      }
      // pay / view: park managers of that park (or SA)
      if (actor.role === Role.SUPER_ADMIN) return;
      if (actor.role !== Role.PARK_MANAGER) {
        throw new ForbiddenException('Only park managers can pay park invoices');
      }
      const managed = await this.managedParkIds(actor);
      if (!managed.includes(invoice.parkId)) {
        throw new ForbiddenException('You do not have access to this park invoice');
      }
      return;
    }

    if (!invoice.factoryId) throw new ForbiddenException('Factory invoice is missing factory scope');
    if (mode === 'manage') {
      if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.PARK_MANAGER) {
        throw new ForbiddenException('You cannot manage this invoice');
      }
      await this.assertFactoryAccess(actor, invoice.factoryId);
      return;
    }
    // pay / view factory invoice: factory owner (or privileged roles with access)
    await this.assertFactoryAccess(actor, invoice.factoryId);
  }

  private presentInvoice<T extends Record<string, any>>(invoice: T) {
    const settlement = this.computeInvoiceSettlement(invoice as any);
    return {
      ...invoice,
      amount: settlement.baseAmount,
      taxAmount: settlement.taxAmount,
      discountAmount: settlement.discountAmount,
      totalAmount: settlement.baseTotal,
      latePenaltyPerDay: settlement.latePenaltyPerDay,
      lateDays: settlement.lateDays,
      latePenaltyAmount: settlement.latePenaltyAmount,
      payableAmount: settlement.payableAmount,
      status: settlement.status,
    };
  }
}
