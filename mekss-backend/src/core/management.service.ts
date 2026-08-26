import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdvertisementStatus, EmergencyStatus, GatePassStatus, InvoiceStatus, ParkStatus, PaymentStatus, Prisma, RequestStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AuditService } from './audit.service';
import { AuthenticatedUser } from './auth.guard';
import { PrismaService } from './prisma.service';

@Injectable()
export class ManagementService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly config: ConfigService) {}

  async users(query?: { page?: number; pageSize?: number; search?: string }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query?.pageSize) || 20));
    const search = query?.search?.trim();
    const where: Prisma.UserWhereInput = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phoneNumber: { contains: search } }, { email: { contains: search, mode: 'insensitive' } }] }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, phoneNumber: true, name: true, email: true, role: true, isApproved: true, isActive: true, mustChangePassword: true, createdAt: true } }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async userDetail(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, phoneNumber: true, name: true, email: true, role: true, isApproved: true, isActive: true, mustChangePassword: true, createdAt: true, managedFactories: { select: { id: true, name: true } }, managedParks: { select: { id: true, name: true } } } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async deleteUser(actor: AuthenticatedUser, id: string) {
    if (actor.id === id) throw new ForbiddenException('You cannot delete your own account');
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === Role.SUPER_ADMIN) {
      const activeSuperAdmins = await this.prisma.user.count({ where: { role: Role.SUPER_ADMIN, isActive: true, isApproved: true } });
      if (activeSuperAdmins <= 1) throw new ForbiddenException('Cannot remove the final active super administrator');
    }
    const protectedRelations = await Promise.all([
      this.prisma.factory.count({ where: { managerId: id } }),
      this.prisma.industrialPark.count({ where: { managers: { some: { id } } } }),
    ]);
    if (protectedRelations.some((count) => count > 0)) throw new ConflictException('User has protected relations and cannot be deleted');
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
    await this.audit.record({ userId: actor.id, action: 'USER_DELETED', entity: 'User', entityId: id });
    return { id, deleted: true };
  }

  async setUserActive(actor: AuthenticatedUser, id: string, isActive: boolean) {
    if (actor.id === id && !isActive) throw new ForbiddenException('You cannot deactivate your own account');
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (!isActive && target.role === Role.SUPER_ADMIN) {
      const activeSuperAdmins = await this.prisma.user.count({ where: { role: Role.SUPER_ADMIN, isActive: true, isApproved: true } });
      if (activeSuperAdmins <= 1) throw new ForbiddenException('Cannot deactivate the final active super administrator');
    }
    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { isActive } }),
      this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.record({ userId: actor.id, action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', entity: 'User', entityId: id });
    return this.safeUser(user);
  }

  async resetUserPassword(actor: AuthenticatedUser, id: string, newPassword: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { password: await bcrypt.hash(newPassword, 12), mustChangePassword: true } }),
      this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.record({ userId: actor.id, action: 'USER_PASSWORD_RESET', entity: 'User', entityId: id });
    return this.safeUser(user);
  }

  async parks(query?: { page?: number; pageSize?: number; search?: string }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query?.pageSize) || 20));
    const search = query?.search?.trim();
    const where: Prisma.IndustrialParkWhereInput = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }, { city: { contains: search, mode: 'insensitive' } }] }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.industrialPark.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { managers: { select: { id: true, name: true, phoneNumber: true } }, _count: { select: { factories: true } } } }),
      this.prisma.industrialPark.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async parkDetail(id: string) {
    const park = await this.prisma.industrialPark.findUnique({ where: { id }, include: { managers: { select: { id: true, name: true, phoneNumber: true } }, _count: { select: { factories: true } } } });
    if (!park) throw new NotFoundException('Park not found');
    return park;
  }

  async createPark(actor: AuthenticatedUser, input: any) {
    for (const key of ['code', 'name', 'province', 'city', 'address', 'phoneNumber', 'guardPhone']) this.text(input[key], key);
    const existing = await this.prisma.industrialPark.findUnique({ where: { code: input.code.trim() } });
    if (existing) throw new ConflictException('A park with this code already exists');
    if (input.managerIds?.length) await this.assertManagersValid(input.managerIds);
    const park = await this.prisma.industrialPark.create({
      data: {
        code: input.code.trim(),
        name: input.name,
        province: input.province,
        city: input.city,
        address: input.address,
        phoneNumber: input.phoneNumber,
        email: input.email,
        guardPhone: input.guardPhone,
        totalArea: input.totalArea ? Number(input.totalArea) : undefined,
        establishedDate: input.establishedDate ? new Date(input.establishedDate) : undefined,
        description: input.description,
        status: (input.status as ParkStatus) || ParkStatus.ACTIVE,
        managers: input.managerIds?.length ? { connect: input.managerIds.map((id: string) => ({ id })) } : undefined,
      },
      include: { managers: { select: { id: true, name: true, phoneNumber: true } } },
    });
    await this.audit.record({ userId: actor.id, action: 'PARK_CREATED', entity: 'IndustrialPark', entityId: park.id });
    return park;
  }

  async updatePark(actor: AuthenticatedUser, id: string, input: any) {
    const existing = await this.prisma.industrialPark.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Park not found');
    if (input.managerIds) await this.assertManagersValid(input.managerIds);
    const data: any = {};
    for (const key of ['name', 'province', 'city', 'address', 'phoneNumber', 'email', 'guardPhone', 'description']) if (input[key] !== undefined) data[key] = input[key];
    if (input.totalArea !== undefined) data.totalArea = Number(input.totalArea);
    if (input.establishedDate !== undefined) data.establishedDate = input.establishedDate ? new Date(input.establishedDate) : null;
    if (input.status !== undefined) data.status = input.status as ParkStatus;
    if (input.managerIds !== undefined) data.managers = { set: input.managerIds.map((managerId: string) => ({ id: managerId })) };
    const park = await this.prisma.industrialPark.update({ where: { id }, data, include: { managers: { select: { id: true, name: true, phoneNumber: true } } } });
    await this.audit.record({ userId: actor.id, action: 'PARK_UPDATED', entity: 'IndustrialPark', entityId: id, changes: data });
    return park;
  }

  async deletePark(actor: AuthenticatedUser, id: string) {
    const existing = await this.prisma.industrialPark.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Park not found');
    const protectedRelations = await Promise.all([
      this.prisma.factory.count({ where: { parkId: id } }),
      this.prisma.securityGuard.count({ where: { parkId: id } }),
      this.prisma.announcement.count({ where: { parkId: id } }),
    ]);
    if (protectedRelations.some((count) => count > 0)) throw new ConflictException('Park has protected relations and cannot be deleted');
    await this.prisma.industrialPark.delete({ where: { id } });
    await this.audit.record({ userId: actor.id, action: 'PARK_DELETED', entity: 'IndustrialPark', entityId: id });
    return { id, deleted: true };
  }

  private async assertManagersValid(managerIds: string[]) {
    if (!managerIds.length) return;
    const count = await this.prisma.user.count({ where: { id: { in: managerIds }, role: Role.PARK_MANAGER } });
    if (count !== managerIds.length) throw new BadRequestException('One or more managers are invalid');
  }

  async createUser(actor: AuthenticatedUser, input: any) {
    this.text(input.phoneNumber, 'phoneNumber'); this.text(input.name, 'name'); this.text(input.password, 'password');
    if (!Object.values(Role).includes(input.role)) throw new BadRequestException('Invalid role');
    const user = await this.prisma.user.create({ data: { phoneNumber: input.phoneNumber, name: input.name, password: await bcrypt.hash(input.password, 12), email: input.email, role: input.role, isApproved: Boolean(input.isApproved), mustChangePassword: true } });
    await this.audit.record({ userId: actor.id, action: 'USER_CREATED', entity: 'User', entityId: user.id, changes: { role: user.role } });
    return this.safeUser(user);
  }

  async updateUser(actor: AuthenticatedUser, id: string, input: any) {
    const data: any = {};
    for (const key of ['name', 'email', 'isApproved', 'isActive', 'mustChangePassword']) if (input[key] !== undefined) data[key] = input[key];
    if (input.role !== undefined) {
      if (!Object.values(Role).includes(input.role)) throw new BadRequestException('Invalid role');
      data.role = input.role;
    }
    if (input.password) { data.password = await bcrypt.hash(input.password, 12); data.mustChangePassword = true; }
    const user = await this.prisma.user.update({ where: { id }, data });
    await this.audit.record({ userId: actor.id, action: 'USER_UPDATED', entity: 'User', entityId: id, changes: data });
    return this.safeUser(user);
  }

  async listFactories(user: AuthenticatedUser) {
    return this.prisma.factory.findMany({ where: await this.factoryFilter(user), include: { park: true, manager: { select: { id: true, name: true, phoneNumber: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async createFactory(actor: AuthenticatedUser, input: any) {
    for (const key of ['name', 'licenseNumber', 'nationalId', 'activityType', 'address', 'phoneNumber', 'parkId', 'managerId']) this.text(input[key], key);
    await this.assertParkAccess(actor, input.parkId);
    const factory = await this.prisma.factory.create({ data: { name: input.name, licenseNumber: input.licenseNumber, nationalId: input.nationalId, activityType: input.activityType, address: input.address, phoneNumber: input.phoneNumber, email: input.email, website: input.website, description: input.description, parkId: input.parkId, managerId: input.managerId, status: input.status || 'PENDING', isApproved: actor.role === Role.SUPER_ADMIN } as any });
    await this.audit.record({ userId: actor.id, action: 'FACTORY_CREATED', entity: 'Factory', entityId: factory.id });
    return factory;
  }

  async updateFactory(actor: AuthenticatedUser, id: string, input: any) {
    await this.assertFactoryAccess(actor, id);
    const factory = await this.prisma.factory.update({ where: { id }, data: input });
    await this.audit.record({ userId: actor.id, action: 'FACTORY_UPDATED', entity: 'Factory', entityId: id, changes: input });
    return factory;
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
  async createAnnouncement(actor: AuthenticatedUser, input: any) { this.text(input.title, 'title'); this.text(input.content, 'content'); const item = await this.prisma.announcement.create({ data: { title: input.title, content: input.content, isGlobal: Boolean(input.isGlobal), isPinned: Boolean(input.isPinned), priority: Number(input.priority || 0), parkId: input.parkId, expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined, createdById: actor.id } }); await this.audit.record({ userId: actor.id, action: 'ANNOUNCEMENT_CREATED', entity: 'Announcement', entityId: item.id }); return item; }

  async managedAnnouncements(actor: AuthenticatedUser) {
    const where = actor.role === Role.SUPER_ADMIN ? {} : { OR: [{ createdById: actor.id }, { parkId: { in: await this.managedParkIds(actor) } }] };
    return this.prisma.announcement.findMany({ where, orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }] });
  }

  async updateAnnouncement(actor: AuthenticatedUser, id: string, input: any) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');
    await this.assertAnnouncementAccess(actor, existing);
    const data: any = {};
    for (const key of ['title', 'content', 'isGlobal', 'isPinned', 'priority']) if (input[key] !== undefined) data[key] = input[key];
    if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    const item = await this.prisma.announcement.update({ where: { id }, data });
    await this.audit.record({ userId: actor.id, action: 'ANNOUNCEMENT_UPDATED', entity: 'Announcement', entityId: id, changes: data });
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

  async advertisements() { return this.prisma.advertisement.findMany({ where: { status: AdvertisementStatus.APPROVED }, orderBy: { createdAt: 'desc' } }); }
  async createAdvertisement(actor: AuthenticatedUser, input: any) { for (const key of ['title', 'category', 'province', 'city', 'content']) this.text(input[key], key); const item = await this.prisma.advertisement.create({ data: { ...input, images: input.images || [], contactInfo: input.contactInfo || {}, createdById: actor.id } }); await this.audit.record({ userId: actor.id, action: 'ADVERTISEMENT_CREATED', entity: 'Advertisement', entityId: item.id }); return item; }
  async approveAdvertisement(actor: AuthenticatedUser, id: string, approved: boolean, rejectionReason?: string) {
    const existing = await this.prisma.advertisement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Advertisement not found');
    if (existing.status !== AdvertisementStatus.PENDING) throw new ConflictException('Advertisement decision was already recorded');
    if (!approved && !rejectionReason?.trim()) throw new BadRequestException('A rejection reason is required');
    if (actor.role !== Role.SUPER_ADMIN) {
      const scope = await this.managedParkIds(actor);
      if (existing.parkId && !scope.includes(existing.parkId)) throw new ForbiddenException('You do not have access to this advertisement');
    }
    const item = await this.prisma.advertisement.update({ where: { id }, data: { status: approved ? AdvertisementStatus.APPROVED : AdvertisementStatus.REJECTED, isApproved: approved, rejectionReason: approved ? null : rejectionReason?.trim(), moderatedById: actor.id, moderatedAt: new Date() } });
    await this.audit.record({ userId: actor.id, action: approved ? 'ADVERTISEMENT_APPROVED' : 'ADVERTISEMENT_REJECTED', entity: 'Advertisement', entityId: id });
    return item;
  }

  async managedAdvertisements(actor: AuthenticatedUser, statusFilter: 'PENDING' | 'HISTORY') {
    const where: Prisma.AdvertisementWhereInput = statusFilter === 'PENDING' ? { status: AdvertisementStatus.PENDING } : { status: { not: AdvertisementStatus.PENDING } };
    if (actor.role !== Role.SUPER_ADMIN) {
      const scope = await this.managedParkIds(actor);
      where.parkId = { in: scope };
    }
    return this.prisma.advertisement.findMany({ where, include: { createdBy: { select: { id: true, name: true, phoneNumber: true } }, park: { select: { id: true, name: true } }, moderatedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async emergencies() { return this.prisma.emergencyAlert.findMany({ include: { createdBy: { select: { name: true, phoneNumber: true } } }, orderBy: { createdAt: 'desc' } }); }
  async createEmergency(actor: AuthenticatedUser, input: any) { this.text(input.title, 'title'); this.text(input.description, 'description'); const item = await this.prisma.emergencyAlert.create({ data: { title: input.title, description: input.description, severity: input.severity || 'HIGH', location: input.location, createdById: actor.id } as any }); await this.prisma.notification.create({ data: { userId: actor.id, title: 'هشدار اضطراری ثبت شد', body: input.title, type: 'EMERGENCY' } }); await this.audit.record({ userId: actor.id, action: 'EMERGENCY_CREATED', entity: 'EmergencyAlert', entityId: item.id }); return item; }
  async emergencyAction(actor: AuthenticatedUser, id: string, action: 'acknowledge' | 'resolve') { const item = await this.prisma.emergencyAlert.update({ where: { id }, data: action === 'resolve' ? { status: EmergencyStatus.RESOLVED, resolvedAt: new Date() } : { status: EmergencyStatus.ACKNOWLEDGED } }); await this.audit.record({ userId: actor.id, action: `EMERGENCY_${action.toUpperCase()}`, entity: 'EmergencyAlert', entityId: id }); return item; }

  async dashboard(user: AuthenticatedUser) {
    const factoryIds = await this.factoryIds(user);
    const factoryWhere = factoryIds.length ? { factoryId: { in: factoryIds } } : undefined;
    const [factories, passes, invoices, requests, emergencies, pendingGatePasses, pendingRequests, pendingAdvertisements] = await Promise.all([
      this.prisma.factory.count({ where: await this.factoryFilter(user) }),
      this.prisma.gatePass.count({ where: factoryWhere }),
      this.prisma.invoice.count({ where: factoryWhere }),
      this.prisma.request.count({ where: factoryWhere }),
      this.prisma.emergencyAlert.count({ where: { status: { not: EmergencyStatus.RESOLVED } } }),
      this.prisma.gatePass.count({ where: { ...factoryWhere, status: GatePassStatus.PENDING } }),
      this.prisma.request.count({ where: { ...factoryWhere, status: RequestStatus.PENDING } }),
      user.role === Role.SUPER_ADMIN || user.role === Role.PARK_MANAGER
        ? this.prisma.advertisement.count({ where: { status: AdvertisementStatus.PENDING, ...(user.role === Role.PARK_MANAGER ? { parkId: { in: await this.managedParkIds(user) } } : {}) } })
        : Promise.resolve(0),
    ]);
    return {
      factories,
      gatePasses: passes,
      invoices,
      requests,
      openEmergencies: emergencies,
      pendingWork: { gatePasses: pendingGatePasses, requests: pendingRequests, advertisements: pendingAdvertisements },
      capabilities: this.dashboardCapabilities(user.role),
    };
  }

  async managedParkIds(user: AuthenticatedUser): Promise<string[]> {
    if (user.role === Role.SUPER_ADMIN) {
      const parks = await this.prisma.industrialPark.findMany({ select: { id: true } });
      return parks.map((park) => park.id);
    }
    const parks = await this.prisma.industrialPark.findMany({ where: { managers: { some: { id: user.id } } }, select: { id: true } });
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
    const factoryWhere = factoryIds.length ? { factoryId: { in: factoryIds } } : undefined;
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

  private async factoryIds(user: AuthenticatedUser): Promise<string[]> { const factories = await this.prisma.factory.findMany({ where: await this.factoryFilter(user), select: { id: true } }); return factories.map((factory) => factory.id); }
  private async factoryFilter(user: AuthenticatedUser): Promise<any> { if (user.role === Role.SUPER_ADMIN || user.role === Role.GOVERNMENT_OFFICIAL) return {}; if (user.role === Role.FACTORY_OWNER) return { managerId: user.id }; const parks = await this.prisma.industrialPark.findMany({ where: user.role === Role.PARK_MANAGER ? { managers: { some: { id: user.id } } } : { securityGuards: { some: { userId: user.id, isActive: true } } }, select: { id: true } }); return { parkId: { in: parks.map((park) => park.id) } }; }
  private async assertFactoryAccess(user: AuthenticatedUser, factoryId: string) { const allowed = await this.prisma.factory.count({ where: { id: factoryId, ...await this.factoryFilter(user) } }); if (!allowed) throw new ForbiddenException('You do not have access to this factory'); }
  private async assertParkAccess(user: AuthenticatedUser, parkId: string) { if (user.role === Role.SUPER_ADMIN) return; if (user.role !== Role.PARK_MANAGER || !(await this.prisma.industrialPark.count({ where: { id: parkId, managers: { some: { id: user.id } } } }))) throw new ForbiddenException('You do not have access to this park'); }
  private paymentResponse(authority: string, paymentUrl?: string) { const callback = this.config.get<string>('ZARINPAL_CALLBACK_URL') || 'http://localhost:3000/api/v1/invoices/payment/callback'; return { authority, paymentUrl: paymentUrl || `${callback}?Authority=${authority}&Status=OK` }; }
  private safeUser(user: any) { const safe = { ...user }; delete safe.password; return safe; }
  private text(value: unknown, field: string) { if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} is required`); }
}
