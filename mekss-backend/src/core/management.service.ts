import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdvertisementStatus, EmergencyStatus, FactoryStatus, GatePassStatus, InvoiceStatus, ParkStatus, PaymentStatus, Prisma, RequestStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AuditService } from './audit.service';
import { AuthenticatedUser } from './auth.guard';
import { AdvertisementAdminQueryDto, CreateAdvertisementDto, CreateAnnouncementDto, CreateFactoryDto, CreateManagedUserDto, CreateParkDto, FactoryAdminQueryDto, UpdateAnnouncementDto, UpdateFactoryDto, UpdateManagedUserDto, UpdateParkDto } from './management.dto';
import { PrismaService } from './prisma.service';
import { currentCorrelationId } from './request-context';

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
  isApproved: true,
  rejectionReason: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  managerId: true,
  parkId: true,
  park: { select: { id: true, code: true, name: true, province: true, city: true, status: true } },
  manager: { select: { id: true, name: true, phoneNumber: true, email: true } },
  reviewedBy: { select: { id: true, name: true } },
});

type FactoryManagementRecord = Prisma.FactoryGetPayload<{ select: typeof FACTORY_MANAGEMENT_SELECT }>;
type FactoryScopeDatabase = Pick<Prisma.TransactionClient, 'factory' | 'industrialPark' | 'user'>;

@Injectable()
export class ManagementService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly config: ConfigService) {}

  async users(query?: { page?: number; pageSize?: number; search?: string }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query?.pageSize) || 20));
    const search = query?.search?.trim();
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phoneNumber: { contains: search } },
            { email: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } },
            { nationalId: { contains: search } },
          ],
        }
      : {};
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
    return this.userLifecycleTransaction(actor, undefined, async (tx) => {
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
    const where: Prisma.IndustrialParkWhereInput = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }, { city: { contains: search, mode: 'insensitive' } }] }
      : {};
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
        ...(search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { licenseNumber: { contains: search, mode: 'insensitive' } },
            { nationalId: { contains: search } },
          ],
        } : {}),
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

  async updateFactory(actor: AuthenticatedUser, id: string, input: UpdateFactoryDto) {
    if (!Object.keys(input).length) throw new BadRequestException('At least one factory field is required');
    return this.auditedTransaction(
      actor,
      {
        action: 'FACTORY_UPDATED',
        entity: 'Factory',
        entityId: id,
        changes: input as unknown as Prisma.InputJsonObject,
      },
      async (tx) => {
        await this.factoryRecord(actor, id, tx);
        const data: Prisma.FactoryUpdateInput = {
          ...input,
          licenseExpiry: input.licenseExpiry === undefined ? undefined : input.licenseExpiry ? new Date(input.licenseExpiry) : null,
          establishedDate: input.establishedDate === undefined ? undefined : input.establishedDate ? new Date(input.establishedDate) : null,
        };
        await tx.factory.update({ where: { id }, data, select: { id: true } });
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
    return this.auditedTransaction(
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
        const item = await tx.factory.findUnique({ where: { id }, select: FACTORY_MANAGEMENT_SELECT });
        if (!item) throw new NotFoundException('Factory not found');
        return item;
      },
    );
  }

  async listGatePasses(user: AuthenticatedUser) { return this.prisma.gatePass.findMany({ where: { factoryId: { in: await this.factoryIds(user) } }, include: { factory: true }, orderBy: { createdAt: 'desc' } }); }

  async createGatePass(actor: AuthenticatedUser, input: any) {
    for (const key of ['factoryId', 'cargoType', 'driverName', 'driverNationalId', 'driverPhone', 'vehicleType', 'licensePlate', 'exitDate']) this.text(input[key], key);
    await this.assertFactoryAccess(actor, input.factoryId);
    const pass = await this.prisma.gatePass.create({ data: { ...input, exitDate: new Date(input.exitDate), createdById: actor.id, qrCode: `MEKSS-${randomBytes(18).toString('hex')}` } as any });
    await this.audit.record({ userId: actor.id, action: 'GATE_PASS_CREATED', entity: 'GatePass', entityId: pass.id });
    return pass;
  }

  async gatePassAction(actor: AuthenticatedUser, id: string, action: 'approve' | 'reject' | 'verify' | 'deny', reason?: string) {
    const pass = await this.prisma.gatePass.findUnique({ where: { id } });
    if (!pass) throw new NotFoundException('Gate pass not found');
    await this.assertFactoryAccess(actor, pass.factoryId);
    const requiresPending = action === 'approve' || action === 'reject';
    const requiresApproved = action === 'verify' || action === 'deny';
    if (requiresPending && pass.status !== GatePassStatus.PENDING) throw new ConflictException('Gate pass decision was already recorded');
    if (requiresApproved && pass.status !== GatePassStatus.APPROVED) throw new ConflictException('Gate pass is not awaiting exit verification');
    if ((action === 'reject' || action === 'deny') && !reason?.trim()) throw new BadRequestException('A reason is required');
    const data =
      action === 'approve' ? { status: GatePassStatus.APPROVED, approvedById: actor.id }
      : action === 'reject' ? { status: GatePassStatus.REJECTED, approvedById: actor.id, notes: reason?.trim() }
      : action === 'verify' ? { status: GatePassStatus.COMPLETED, verifiedById: actor.id, verifiedAt: new Date() }
      : { status: GatePassStatus.REJECTED, verifiedById: actor.id, verifiedAt: new Date(), notes: reason?.trim() };
    const updated = await this.prisma.gatePass.update({ where: { id }, data });
    await this.audit.record({ userId: actor.id, action: `GATE_PASS_${action.toUpperCase()}`, entity: 'GatePass', entityId: id });
    return updated;
  }

  async gatePassDetail(actor: AuthenticatedUser, id: string) {
    const pass = await this.prisma.gatePass.findUnique({ where: { id }, include: { factory: true, createdBy: { select: { id: true, name: true, phoneNumber: true } } } });
    if (!pass) throw new NotFoundException('Gate pass not found');
    await this.assertFactoryAccess(actor, pass.factoryId);
    return pass;
  }

  async listInvoices(user: AuthenticatedUser) { return this.prisma.invoice.findMany({ where: { factoryId: { in: await this.factoryIds(user) } }, include: { factory: true, payments: true }, orderBy: { issueDate: 'desc' } }); }

  async createInvoice(actor: AuthenticatedUser, input: any) {
    for (const key of ['factoryId', 'amount', 'dueDate', 'description']) this.text(String(input[key] ?? ''), key);
    await this.assertFactoryAccess(actor, input.factoryId);
    const amount = Number(input.amount); const taxAmount = Number(input.taxAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(taxAmount)) throw new BadRequestException('Invalid invoice amount');
    const invoice = await this.prisma.invoice.create({ data: { factoryId: input.factoryId, amount, taxAmount, totalAmount: amount + taxAmount, description: input.description, dueDate: new Date(input.dueDate), invoiceNumber: `INV-${Date.now()}-${randomBytes(3).toString('hex')}`, createdById: actor.id } });
    await this.audit.record({ userId: actor.id, action: 'INVOICE_CREATED', entity: 'Invoice', entityId: invoice.id });
    return invoice;
  }

  async startPayment(actor: AuthenticatedUser, invoiceId: string, idempotencyKey?: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    await this.assertFactoryAccess(actor, invoice.factoryId);
    if (invoice.status !== InvoiceStatus.PENDING) throw new BadRequestException('Invoice cannot be paid');
    const key = idempotencyKey || `${invoiceId}:${actor.id}`;
    const existing = await this.prisma.paymentTransaction.findUnique({ where: { idempotencyKey: key } });
    if (existing) return this.paymentResponse(existing.authority);

    const provider = this.config.get<string>('PAYMENT_PROVIDER', 'mock').toLowerCase();
    let authority = randomBytes(18).toString('hex');
    let paymentUrl: string | undefined;
    if (provider === 'zarinpal') {
      const merchantId = this.config.get<string>('ZARINPAL_MERCHANT_ID');
      const callbackUrl = this.config.get<string>('ZARINPAL_CALLBACK_URL');
      if (!merchantId || !callbackUrl) throw new BadRequestException('ZarinPal is not configured');
      const sandbox = this.config.get<string>('ZARINPAL_SANDBOX', 'true') === 'true';
      const baseUrl = sandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
      const response = await fetch(`${baseUrl}/pg/v4/payment/request.json`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ merchant_id: merchantId, amount: Number(invoice.totalAmount), callback_url: callbackUrl, description: invoice.description }) });
      const result: any = await response.json();
      if (!response.ok || result?.data?.code !== 100 || !result?.data?.authority) throw new BadRequestException('Unable to initialize ZarinPal payment');
      authority = result.data.authority;
      paymentUrl = `${baseUrl}/pg/StartPay/${authority}`;
    }
    await this.prisma.paymentTransaction.create({ data: { authority, amount: invoice.totalAmount, invoiceId, initiatedById: actor.id, idempotencyKey: key, provider: provider === 'zarinpal' ? 'ZARINPAL' : 'MOCK' } });
    await this.audit.record({ userId: actor.id, action: 'PAYMENT_INITIATED', entity: 'Invoice', entityId: invoiceId });
    return this.paymentResponse(authority, paymentUrl);
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
    await this.prisma.$transaction([
      this.prisma.paymentTransaction.update({ where: { id: transaction.id }, data: { status: PaymentStatus.VERIFIED, referenceId, verifiedAt: new Date(), providerStatus } }),
      this.prisma.invoice.update({ where: { id: transaction.invoiceId }, data: { status: InvoiceStatus.PAID, paymentDate: new Date(), paymentMethod: transaction.provider, paymentRef: referenceId, paidById: transaction.initiatedById } }),
    ]);
    await this.audit.record({ userId: transaction.initiatedById || undefined, action: 'PAYMENT_VERIFIED', entity: 'Invoice', entityId: transaction.invoiceId });
    return { status: 'verified', invoiceId: transaction.invoiceId, referenceId };
  }

  async listRequests(user: AuthenticatedUser) { return this.prisma.request.findMany({ where: { factoryId: { in: await this.factoryIds(user) } }, include: { factory: true, creator: { select: { name: true, phoneNumber: true } } }, orderBy: { createdAt: 'desc' } }); }

  async createRequest(actor: AuthenticatedUser, input: any) {
    for (const key of ['factoryId', 'type', 'title', 'description']) this.text(input[key], key);
    await this.assertFactoryAccess(actor, input.factoryId);
    const request = await this.prisma.request.create({ data: { factoryId: input.factoryId, type: input.type, title: input.title, description: input.description, data: input.data || {}, attachments: input.attachments || [], priority: input.priority || 'MEDIUM', creatorId: actor.id } as any });
    await this.audit.record({ userId: actor.id, action: 'REQUEST_CREATED', entity: 'Request', entityId: request.id });
    return request;
  }

  async requestAction(actor: AuthenticatedUser, id: string, action: 'approve' | 'reject', reason?: string) {
    const request = await this.prisma.request.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');
    await this.assertFactoryAccess(actor, request.factoryId);
    if (request.status !== RequestStatus.PENDING) throw new BadRequestException('Request is not pending');
    const data = action === 'approve' ? { status: RequestStatus.APPROVED, approverId: actor.id, approvedAt: new Date() } : { status: RequestStatus.REJECTED, approverId: actor.id, rejectedAt: new Date(), rejectionReason: reason || 'Rejected' };
    const updated = await this.prisma.request.update({ where: { id }, data });
    await this.audit.record({ userId: actor.id, action: `REQUEST_${action.toUpperCase()}`, entity: 'Request', entityId: id });
    return updated;
  }

  async announcements() { return this.prisma.announcement.findMany({ where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }] }); }
  async createAnnouncement(actor: AuthenticatedUser, input: CreateAnnouncementDto) {
    if (input.parkId) await this.assertParkScope(actor, input.parkId);
    const item = await this.prisma.announcement.create({
      data: {
        title: input.title,
        content: input.content,
        isGlobal: Boolean(input.isGlobal),
        isPinned: Boolean(input.isPinned),
        priority: Number(input.priority || 0),
        parkId: input.parkId,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        createdById: actor.id,
      },
    });
    await this.audit.record({ userId: actor.id, action: 'ANNOUNCEMENT_CREATED', entity: 'Announcement', entityId: item.id });
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

  async advertisements() {
    return this.prisma.advertisement.findMany({
      where: { status: AdvertisementStatus.APPROVED },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
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

  async approveAdvertisement(actor: AuthenticatedUser, id: string, approved: boolean, rejectionReason?: string) {
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
        ...(search ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { content: { contains: search, mode: 'insensitive' } },
            { province: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
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

  async emergencies() { return this.prisma.emergencyAlert.findMany({ include: { createdBy: { select: { name: true, phoneNumber: true } } }, orderBy: { createdAt: 'desc' } }); }
  async createEmergency(actor: AuthenticatedUser, input: any) { this.text(input.title, 'title'); this.text(input.description, 'description'); const item = await this.prisma.emergencyAlert.create({ data: { title: input.title, description: input.description, severity: input.severity || 'HIGH', location: input.location, createdById: actor.id } as any }); await this.prisma.notification.create({ data: { userId: actor.id, title: 'هشدار اضطراری ثبت شد', body: input.title, type: 'EMERGENCY' } }); await this.audit.record({ userId: actor.id, action: 'EMERGENCY_CREATED', entity: 'EmergencyAlert', entityId: item.id }); return item; }
  async emergencyAction(actor: AuthenticatedUser, id: string, action: 'acknowledge' | 'resolve') { const item = await this.prisma.emergencyAlert.update({ where: { id }, data: action === 'resolve' ? { status: EmergencyStatus.RESOLVED, resolvedAt: new Date() } : { status: EmergencyStatus.ACKNOWLEDGED } }); await this.audit.record({ userId: actor.id, action: `EMERGENCY_${action.toUpperCase()}`, entity: 'EmergencyAlert', entityId: id }); return item; }

  async dashboard(user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const isSuperAdmin = user.role === Role.SUPER_ADMIN;
      const isParkManager = user.role === Role.PARK_MANAGER;
      const hasGlobalFactoryScope = isSuperAdmin || user.role === Role.GOVERNMENT_OFFICIAL;
      const factoryScope: Prisma.FactoryWhereInput = isParkManager
        ? { park: { is: { managers: { some: { id: user.id } } } } }
        : user.role === Role.FACTORY_OWNER
          ? { managerId: user.id }
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
      ] = await Promise.all([
        tx.factory.count({ where: factoryScope }),
        tx.gatePass.count({ where: factoryWhere }),
        tx.invoice.count({ where: factoryWhere }),
        tx.request.count({ where: factoryWhere }),
        tx.emergencyAlert.count({ where: { status: { not: EmergencyStatus.RESOLVED } } }),
        tx.gatePass.count({ where: { ...factoryWhere, status: GatePassStatus.PENDING } }),
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

      return {
        factories,
        gatePasses: passes,
        invoices,
        requests,
        openEmergencies: emergencies,
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
      where = { status: ParkStatus.ACTIVE, factories: { some: { managerId: actor.id } } };
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

  async inboxMessages(actor: AuthenticatedUser) {
    return this.prisma.message.findMany({
      where: { receiverId: actor.id },
      include: { sender: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markMessageRead(actor: AuthenticatedUser, id: string) {
    const message = await this.prisma.message.findUnique({ where: { id } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.receiverId !== actor.id) throw new ForbiddenException('You do not have access to this message');
    if (message.status === 'READ') return message;
    return this.prisma.message.update({ where: { id }, data: { status: 'READ' } });
  }

  async sendMessage(actor: AuthenticatedUser, recipientIds: string[], subject: string, body: string) {
    const scopedIds = Array.from(new Set(recipientIds));
    const validRecipients = await this.prisma.user.findMany({ where: { id: { in: scopedIds }, isActive: true }, select: { id: true } });
    if (!validRecipients.length) throw new BadRequestException('No valid recipients were resolved');
    const excludedCount = scopedIds.length - validRecipients.length;
    const created = await this.prisma.$transaction(
      validRecipients.map((recipient) => this.prisma.message.create({ data: { senderId: actor.id, receiverId: recipient.id, subject, body } })),
    );
    await this.audit.record({ userId: actor.id, action: 'MESSAGE_BATCH_SENT', entity: 'Message', entityId: created.map((message) => message.id).join(','), changes: { recipientCount: created.length } });
    return { sentCount: created.length, excludedCount };
  }

  async report(actor: AuthenticatedUser, type: 'financial' | 'gatepass' | 'requests', from?: string, to?: string) {
    const factoryIds = await this.factoryIds(actor);
    const hasGlobalFactoryScope = actor.role === Role.SUPER_ADMIN || actor.role === Role.GOVERNMENT_OFFICIAL;
    const factoryWhere = hasGlobalFactoryScope ? {} : { factoryId: { in: factoryIds } };
    const dateFilter = from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined;
    if (type === 'financial') {
      const invoices = await this.prisma.invoice.findMany({ where: { ...factoryWhere, ...(dateFilter ? { issueDate: dateFilter } : {}) }, select: { status: true, totalAmount: true } });
      const totals = invoices.reduce((acc, invoice) => { acc.total += Number(invoice.totalAmount); if (invoice.status === InvoiceStatus.PAID) acc.paid += Number(invoice.totalAmount); return acc; }, { total: 0, paid: 0 });
      return { type, count: invoices.length, totalAmount: totals.total, paidAmount: totals.paid, unpaidAmount: totals.total - totals.paid };
    }
    if (type === 'gatepass') {
      const passes = await this.prisma.gatePass.groupBy({ by: ['status'], where: { ...factoryWhere, ...(dateFilter ? { createdAt: dateFilter } : {}) }, _count: true });
      return { type, byStatus: passes.map((entry) => ({ status: entry.status, count: entry._count })) };
    }
    const requests = await this.prisma.request.groupBy({ by: ['status'], where: { ...factoryWhere, ...(dateFilter ? { createdAt: dateFilter } : {}) }, _count: true });
    return { type, byStatus: requests.map((entry) => ({ status: entry.status, count: entry._count })) };
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
      PARK_MANAGER: [...shared, 'manage_factories', 'approve_gate_passes', 'approve_requests', 'manage_announcements', 'moderate_advertisements', 'send_messages', 'view_reports'],
      FACTORY_OWNER: [...shared, 'create_gate_passes', 'create_requests', 'create_advertisements', 'view_invoices'],
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
    if (user.role === Role.FACTORY_OWNER) return { managerId: user.id };
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

  private paymentResponse(authority: string, paymentUrl?: string) { const callback = this.config.get<string>('ZARINPAL_CALLBACK_URL') || 'http://localhost:3000/api/v1/invoices/payment/callback'; return { authority, paymentUrl: paymentUrl || `${callback}?Authority=${authority}&Status=OK` }; }
  private text(value: unknown, field: string) { if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} is required`); }
}
