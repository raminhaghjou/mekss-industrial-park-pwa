import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdvertisementStatus, EmergencyStatus, GatePassStatus, InvoiceStatus, PaymentStatus, RequestStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AuditService } from './audit.service';
import { AuthenticatedUser } from './auth.guard';
import { PrismaService } from './prisma.service';

@Injectable()
export class ManagementService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly config: ConfigService) {}

  async users() { return this.prisma.user.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, phoneNumber: true, name: true, email: true, role: true, isApproved: true, isActive: true, mustChangePassword: true, createdAt: true } }); }

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

  async gatePassAction(actor: AuthenticatedUser, id: string, action: 'approve' | 'reject' | 'verify') {
    const pass = await this.prisma.gatePass.findUnique({ where: { id } });
    if (!pass) throw new NotFoundException('Gate pass not found');
    await this.assertFactoryAccess(actor, pass.factoryId);
    const data = action === 'approve' ? { status: GatePassStatus.APPROVED, approvedById: actor.id } : action === 'reject' ? { status: GatePassStatus.REJECTED, approvedById: actor.id } : { status: GatePassStatus.COMPLETED, verifiedById: actor.id, verifiedAt: new Date() };
    const updated = await this.prisma.gatePass.update({ where: { id }, data });
    await this.audit.record({ userId: actor.id, action: `GATE_PASS_${action.toUpperCase()}`, entity: 'GatePass', entityId: id });
    return updated;
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

  async advertisements() { return this.prisma.advertisement.findMany({ where: { status: AdvertisementStatus.APPROVED }, orderBy: { createdAt: 'desc' } }); }
  async createAdvertisement(actor: AuthenticatedUser, input: any) { for (const key of ['title', 'category', 'province', 'city', 'content']) this.text(input[key], key); const item = await this.prisma.advertisement.create({ data: { ...input, images: input.images || [], contactInfo: input.contactInfo || {}, createdById: actor.id } }); await this.audit.record({ userId: actor.id, action: 'ADVERTISEMENT_CREATED', entity: 'Advertisement', entityId: item.id }); return item; }
  async approveAdvertisement(actor: AuthenticatedUser, id: string, approved: boolean, rejectionReason?: string) { const item = await this.prisma.advertisement.update({ where: { id }, data: { status: approved ? AdvertisementStatus.APPROVED : AdvertisementStatus.REJECTED, isApproved: approved, rejectionReason } }); await this.audit.record({ userId: actor.id, action: approved ? 'ADVERTISEMENT_APPROVED' : 'ADVERTISEMENT_REJECTED', entity: 'Advertisement', entityId: id }); return item; }

  async emergencies() { return this.prisma.emergencyAlert.findMany({ include: { createdBy: { select: { name: true, phoneNumber: true } } }, orderBy: { createdAt: 'desc' } }); }
  async createEmergency(actor: AuthenticatedUser, input: any) { this.text(input.title, 'title'); this.text(input.description, 'description'); const item = await this.prisma.emergencyAlert.create({ data: { title: input.title, description: input.description, severity: input.severity || 'HIGH', location: input.location, createdById: actor.id } as any }); await this.prisma.notification.create({ data: { userId: actor.id, title: 'هشدار اضطراری ثبت شد', body: input.title, type: 'EMERGENCY' } }); await this.audit.record({ userId: actor.id, action: 'EMERGENCY_CREATED', entity: 'EmergencyAlert', entityId: item.id }); return item; }
  async emergencyAction(actor: AuthenticatedUser, id: string, action: 'acknowledge' | 'resolve') { const item = await this.prisma.emergencyAlert.update({ where: { id }, data: action === 'resolve' ? { status: EmergencyStatus.RESOLVED, resolvedAt: new Date() } : { status: EmergencyStatus.ACKNOWLEDGED } }); await this.audit.record({ userId: actor.id, action: `EMERGENCY_${action.toUpperCase()}`, entity: 'EmergencyAlert', entityId: id }); return item; }

  async dashboard(user: AuthenticatedUser) { const factoryIds = await this.factoryIds(user); const factoryWhere = factoryIds.length ? { factoryId: { in: factoryIds } } : undefined; const [factories, passes, invoices, requests, emergencies] = await Promise.all([this.prisma.factory.count({ where: await this.factoryFilter(user) }), this.prisma.gatePass.count({ where: factoryWhere }), this.prisma.invoice.count({ where: factoryWhere }), this.prisma.request.count({ where: factoryWhere }), this.prisma.emergencyAlert.count({ where: { status: { not: EmergencyStatus.RESOLVED } } })]); return { factories, gatePasses: passes, invoices, requests, openEmergencies: emergencies }; }

  private async factoryIds(user: AuthenticatedUser): Promise<string[]> { const factories = await this.prisma.factory.findMany({ where: await this.factoryFilter(user), select: { id: true } }); return factories.map((factory) => factory.id); }
  private async factoryFilter(user: AuthenticatedUser): Promise<any> { if (user.role === Role.SUPER_ADMIN || user.role === Role.GOVERNMENT_OFFICIAL) return {}; if (user.role === Role.FACTORY_OWNER) return { managerId: user.id }; const parks = await this.prisma.industrialPark.findMany({ where: user.role === Role.PARK_MANAGER ? { managers: { some: { id: user.id } } } : { securityGuards: { some: { userId: user.id, isActive: true } } }, select: { id: true } }); return { parkId: { in: parks.map((park) => park.id) } }; }
  private async assertFactoryAccess(user: AuthenticatedUser, factoryId: string) { const allowed = await this.prisma.factory.count({ where: { id: factoryId, ...await this.factoryFilter(user) } }); if (!allowed) throw new ForbiddenException('You do not have access to this factory'); }
  private async assertParkAccess(user: AuthenticatedUser, parkId: string) { if (user.role === Role.SUPER_ADMIN) return; if (user.role !== Role.PARK_MANAGER || !(await this.prisma.industrialPark.count({ where: { id: parkId, managers: { some: { id: user.id } } } }))) throw new ForbiddenException('You do not have access to this park'); }
  private paymentResponse(authority: string, paymentUrl?: string) { const callback = this.config.get<string>('ZARINPAL_CALLBACK_URL') || 'http://localhost:3000/api/v1/invoices/payment/callback'; return { authority, paymentUrl: paymentUrl || `${callback}?Authority=${authority}&Status=OK` }; }
  private safeUser(user: any) { const { password, ...safe } = user; return safe; }
  private text(value: unknown, field: string) { if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} is required`); }
}
