import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaClient, Role, FactoryStatus, InvoiceStatus, RequestPriority, RequestStatus, RequestType, CargoType, VehicleType } from '@prisma/client';

const prisma = new PrismaClient();

const development = process.env.NODE_ENV !== 'production';
const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required when NODE_ENV=production`);
  return value;
};

async function ensureUser(input: {
  phoneNumber: string;
  name: string;
  role: Role;
  password: string;
  approved?: boolean;
  mustChangePassword?: boolean;
  email?: string;
}) {
  const password = await bcrypt.hash(input.password, 12);
  return prisma.user.upsert({
    where: { phoneNumber: input.phoneNumber },
    update: {
      name: input.name,
      role: input.role,
      isApproved: input.approved ?? true,
      isActive: true,
      email: input.email,
    },
    create: {
      phoneNumber: input.phoneNumber,
      name: input.name,
      role: input.role,
      password,
      isApproved: input.approved ?? true,
      isActive: true,
      mustChangePassword: input.mustChangePassword ?? false,
      email: input.email,
    },
  });
}

async function main() {
  const adminPassword = development
    ? process.env.SEED_ADMIN_PASSWORD || randomBytes(18).toString('base64url')
    : requireEnv('SEED_ADMIN_PASSWORD');
  const adminPhone = development ? process.env.SEED_ADMIN_PHONE || '09120000000' : requireEnv('SEED_ADMIN_PHONE');
  const adminName = development ? process.env.SEED_ADMIN_NAME || 'مدیر سامانه MEKSS' : requireEnv('SEED_ADMIN_NAME');

  const existingAdmin = await prisma.user.findUnique({ where: { phoneNumber: adminPhone } });
  const superAdmin = await ensureUser({
    phoneNumber: adminPhone,
    name: adminName,
    role: Role.SUPER_ADMIN,
    password: adminPassword,
    approved: true,
    mustChangePassword: development,
    email: process.env.SEED_ADMIN_EMAIL || undefined,
  });

  if (!existingAdmin && development && !process.env.SEED_ADMIN_PASSWORD) {
    console.info(`Development Super Admin created for ${adminPhone}. Temporary password: ${adminPassword}`);
    console.info('Store this password securely; it is only printed when the account is first created.');
  }

  if (!development) {
    console.info(`Production Super Admin is ready for ${adminPhone}.`);
    return;
  }

  const demoPassword = process.env.SEED_DEMO_PASSWORD || adminPassword;

  const parkManager = await ensureUser({
    phoneNumber: '09120000001',
    name: 'مدیر پارک نمونه',
    role: Role.PARK_MANAGER,
    password: demoPassword,
    email: 'park.manager@example.test',
  });
  const factoryOwner = await ensureUser({
    phoneNumber: '09120000002',
    name: 'مالک کارخانه نمونه',
    role: Role.FACTORY_OWNER,
    password: demoPassword,
    email: 'factory.owner@example.test',
  });
  const guard = await ensureUser({
    phoneNumber: '09120000003',
    name: 'نگهبان نمونه',
    role: Role.SECURITY_GUARD,
    password: demoPassword,
  });
  await ensureUser({
    phoneNumber: '09120000004',
    name: 'ناظر دولتی نمونه',
    role: Role.GOVERNMENT_OFFICIAL,
    password: demoPassword,
  });

  const park = await prisma.industrialPark.upsert({
    where: { code: 'MEKSS-DEMO' },
    update: { managers: { connect: { id: parkManager.id } } },
    create: {
      code: 'MEKSS-DEMO',
      name: 'شهرک صنعتی نمونه MEKSS',
      province: 'تهران',
      city: 'تهران',
      address: 'آدرس نمونه برای محیط توسعه',
      phoneNumber: '02100000000',
      guardPhone: guard.phoneNumber,
      managers: { connect: { id: parkManager.id } },
    },
  });

  const factory = await prisma.factory.upsert({
    where: { licenseNumber: 'MEKSS-DEMO-LICENSE' },
    update: { managerId: factoryOwner.id, parkId: park.id, status: FactoryStatus.ACTIVE, isApproved: true },
    create: {
      name: 'کارخانه نمونه MEKSS',
      licenseNumber: 'MEKSS-DEMO-LICENSE',
      nationalId: '14000000000',
      activityType: 'تولید نمونه',
      address: 'آدرس کارخانه نمونه',
      phoneNumber: '02100000001',
      managerId: factoryOwner.id,
      parkId: park.id,
      status: FactoryStatus.ACTIVE,
      isApproved: true,
    },
  });

  await prisma.factoryEmployee.upsert({
    where: { nationalId: '0012345678' },
    update: { factoryId: factory.id },
    create: {
      name: 'کارمند نمونه',
      phoneNumber: '09120000005',
      nationalId: '0012345678',
      position: 'اپراتور',
      department: 'تولید',
      hireDate: new Date('2024-01-01'),
      salary: 100000000,
      factoryId: factory.id,
    },
  });

  const invoice = await prisma.invoice.upsert({
    where: { invoiceNumber: 'DEMO-0001' },
    update: {},
    create: {
      invoiceNumber: 'DEMO-0001',
      amount: 10000000,
      taxAmount: 900000,
      totalAmount: 10900000,
      description: 'فاکتور نمونهٔ توسعه',
      dueDate: new Date('2026-12-31'),
      status: InvoiceStatus.PENDING,
      factoryId: factory.id,
      createdById: superAdmin.id,
    },
  });

  const gatePass = await prisma.gatePass.findFirst({ where: { qrCode: 'MEKSS-DEMO-GATE-PASS' } });
  if (!gatePass) {
    await prisma.gatePass.create({
      data: {
        cargoType: CargoType.RAW_MATERIALS,
        driverName: 'راننده نمونه',
        driverNationalId: '1234567890',
        driverPhone: '09120000006',
        vehicleType: VehicleType.TRUCK,
        licensePlate: '12الف123-45',
        exitDate: new Date('2026-12-31T12:00:00Z'),
        qrCode: 'MEKSS-DEMO-GATE-PASS',
        factoryId: factory.id,
        createdById: factoryOwner.id,
      },
    });
  }

  const request = await prisma.request.findFirst({ where: { title: 'درخواست نمونه توسعه', factoryId: factory.id } });
  if (!request) {
    await prisma.request.create({
      data: {
        type: RequestType.OTHER,
        title: 'درخواست نمونه توسعه',
        description: 'درخواست نمونه برای اعتبارسنجی داشبورد و workflow.',
        data: { source: 'seed' },
        attachments: [],
        status: RequestStatus.PENDING,
        priority: RequestPriority.MEDIUM,
        factoryId: factory.id,
        creatorId: factoryOwner.id,
      },
    });
  }

  await prisma.securityGuard.upsert({
    where: { userId_shiftStart: { userId: guard.id, shiftStart: new Date('2026-01-01T00:00:00Z') } },
    update: { isActive: true },
    create: {
      userId: guard.id,
      parkId: park.id,
      shiftStart: new Date('2026-01-01T00:00:00Z'),
      shiftEnd: new Date('2026-12-31T23:59:59Z'),
    },
  });

  await prisma.notification.create({
    data: {
      userId: superAdmin.id,
      title: 'داده‌های توسعه آماده‌اند',
      body: `فاکتور ${invoice.invoiceNumber}، کارخانه و گردش‌های نمونه ایجاد شدند.`,
    },
  });

  console.info('Development seed completed. Demo users use the configured password only in this local environment.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
