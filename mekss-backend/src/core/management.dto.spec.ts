import { FactoryStatus } from '@prisma/client';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  AdvertisementAdminQueryDto,
  AdvertisementModerationDto,
  CreateAdvertisementDto,
  CreateAnnouncementDto,
  CreateFactoryDto,
  CreateGatePassDto,
  CreateInvoiceDto,
  CreateManagedUserDto,
  CreateParkDto,
  FactoryAdminQueryDto,
  PaginationQueryDto,
  ResetPasswordAdminDto,
  UpdateFactoryDto,
  UpdateManagedUserDto,
} from './management.dto';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const validate = <T>(metatype: new () => T, value: unknown, type: 'body' | 'query' = 'body') => pipe.transform(value, { type, metatype });

describe('management DTO validation', () => {
  const validGatePass = {
    factoryId: 'cm12345678901234567890123',
    cargoType: 'RAW_MATERIALS',
    cargoDescription: '',
    driverName: 'Test Driver',
    driverNationalId: '1234567890',
    driverPhone: '09120000000',
    vehicleType: 'TRUCK',
    licensePlate: '12A345',
    exitDate: '2026-08-30T10:00:00.000Z',
  };

  it('accepts the existing gate-pass payload and rejects extra fields or non-canonical enums', async () => {
    await expect(validate(CreateGatePassDto, validGatePass)).resolves.toMatchObject(validGatePass);
    await expect(validate(CreateGatePassDto, { ...validGatePass, createdById: 'attacker' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(CreateGatePassDto, { ...validGatePass, cargoType: 'raw_materials' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a real moderation boolean and a non-blank rejection reason', async () => {
    await expect(validate(AdvertisementModerationDto, { approved: true })).resolves.toMatchObject({ approved: true });
    await expect(validate(AdvertisementModerationDto, { approved: 'false', rejectionReason: 'reason' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(AdvertisementModerationDto, { approved: false, rejectionReason: '   ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts both established advertisement contact phone field names and validates every supplied alias', async () => {
    const base = {
      title: 'Advertisement', category: 'OTHER', province: 'Tehran', city: 'Tehran', content: 'Advertisement content',
    };
    await expect(validate(CreateAdvertisementDto, { ...base, contactInfo: { phone: '09120000000' } })).resolves.toMatchObject({ contactInfo: { phone: '09120000000' } });
    await expect(validate(CreateAdvertisementDto, { ...base, contactInfo: { phoneNumber: '09120000000' } })).resolves.toMatchObject({ contactInfo: { phoneNumber: '09120000000' } });
    await expect(validate(CreateAdvertisementDto, { ...base, contactInfo: { phone: '09120000000', phoneNumber: '+98 912 000 0000' } })).resolves.toMatchObject({
      contactInfo: { phone: '09120000000', phoneNumber: '+98 912 000 0000' },
    });
    await expect(validate(CreateAdvertisementDto, { ...base, contactInfo: {} })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(CreateAdvertisementDto, { ...base, contactInfo: { phone: 42, phoneNumber: 43 } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(CreateAdvertisementDto, { ...base, contactInfo: { phone: 'invalid!', phoneNumber: 'also-invalid!' } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(CreateAdvertisementDto, { ...base, contactInfo: { phone: '09120000000', phoneNumber: 'invalid!' } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(CreateAdvertisementDto, { ...base, contactInfo: { phone: 'invalid!', phoneNumber: '09120000000' } })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes managed-user identifiers without changing password bytes', async () => {
    const created = await validate(CreateManagedUserDto, {
      phoneNumber: '+98 912 345 6789',
      name: '  Managed User  ',
      password: ' Pass word123 ',
      email: ' USER@Example.COM ',
      username: ' Admin.User ',
      nationalId: ' 1234567890 ',
      role: 'EMPLOYEE',
      employeeOfFactoryId: 'factory_1',
    });
    expect(created).toMatchObject({
      phoneNumber: '09123456789',
      name: 'Managed User',
      password: ' Pass word123 ',
      email: 'user@example.com',
      username: 'admin.user',
      nationalId: '1234567890',
    });

    await expect(validate(UpdateManagedUserDto, { email: '', username: ' ', nationalId: '' })).resolves.toMatchObject({
      email: null, username: null, nationalId: null,
    });
    await expect(validate(CreateManagedUserDto, {
      phoneNumber: '09123456789', name: 'Valid User', password: 'NoDigitsHere', role: 'EMPLOYEE',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not trim an administrator-supplied replacement password', async () => {
    await expect(validate(ResetPasswordAdminDto, { newPassword: ' Password123 ' })).resolves.toMatchObject({
      newPassword: ' Password123 ',
    });
  });

  it('validates and transforms advertisement administration filters', async () => {
    await expect(validate(AdvertisementAdminQueryDto, {
      view: 'HISTORY', status: 'EXPIRED', search: '  Tehran  ', category: '  OTHER  ',
      parkId: 'park_1', page: '2', pageSize: '100',
    }, 'query')).resolves.toMatchObject({
      view: 'HISTORY', status: 'EXPIRED', search: 'Tehran', category: 'OTHER',
      parkId: 'park_1', page: 2, pageSize: 100,
    });
    await expect(validate(AdvertisementAdminQueryDto, { view: 'PENDING', status: 'PENDING' }, 'query')).resolves.toMatchObject({
      view: 'PENDING', status: 'PENDING',
    });

    for (const invalid of [
      { view: 'ARCHIVE' }, { status: 'UNKNOWN' }, { parkId: 'invalid park' },
      { page: '0' }, { page: '1.5' }, { pageSize: '0' }, { pageSize: '101' },
    ]) {
      await expect(validate(AdvertisementAdminQueryDto, invalid, 'query')).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('normalizes factory contracts, preserves persisted identifier/contact compatibility, and rejects lifecycle injection', async () => {
    const payload = {
      name: '  Durable Factory  ', licenseNumber: '  LIC-11  ', nationalId: '14000000000',
      activityType: '  Manufacturing  ', address: '  Factory address  ', phoneNumber: ' 02100000001 ',
      phoneNumber2: '', landline: ' 02112345678 ', email: ' OWNER@EXAMPLE.COM ', description: ' ',
      parkId: 'park_1', managerId: 'owner_1', employees: '12',
    };
    await expect(validate(CreateFactoryDto, payload)).resolves.toMatchObject({
      name: 'Durable Factory', licenseNumber: 'LIC-11', nationalId: '14000000000',
      activityType: 'Manufacturing', address: 'Factory address', phoneNumber: '02100000001',
      phoneNumber2: null, landline: '02112345678', email: 'owner@example.com', description: null,
      parkId: 'park_1', managerId: 'owner_1', employees: 12,
    });
    await expect(validate(CreateFactoryDto, { ...payload, status: FactoryStatus.ACTIVE })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(CreateFactoryDto, { ...payload, isApproved: true })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(CreateFactoryDto, { ...payload, nationalId: '123' })).rejects.toBeInstanceOf(BadRequestException);

    await expect(validate(UpdateFactoryDto, { name: '  Renamed Factory  ', email: '', description: ' ' })).resolves.toMatchObject({
      name: 'Renamed Factory', email: null, description: null,
    });
    for (const protectedBody of [
      { status: FactoryStatus.ACTIVE }, { isApproved: true }, { parkId: 'park_2' }, { managerId: 'owner_2' },
      { rejectionReason: 'forged' }, { reviewedById: 'admin_1' }, { reviewedAt: new Date().toISOString() },
    ]) {
      await expect(validate(UpdateFactoryDto, protectedBody)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('validates and transforms managed factory filters', async () => {
    await expect(validate(FactoryAdminQueryDto, {
      status: FactoryStatus.PENDING, search: '  steel  ', parkId: 'park_1', page: '2', pageSize: '100',
    }, 'query')).resolves.toMatchObject({
      status: FactoryStatus.PENDING, search: 'steel', parkId: 'park_1', page: 2, pageSize: 100,
    });
    for (const invalid of [
      { status: 'APPROVED' }, { parkId: 'invalid park' }, { page: '0' }, { page: '1.5' }, { pageSize: '101' },
    ]) {
      await expect(validate(FactoryAdminQueryDto, invalid, 'query')).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('requires integer bounded pagination values', async () => {
    await expect(validate(PaginationQueryDto, { page: '2', pageSize: '100' }, 'query')).resolves.toMatchObject({ page: 2, pageSize: 100 });
    await expect(validate(PaginationQueryDto, { page: '1.5' }, 'query')).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(PaginationQueryDto, { pageSize: '101' }, 'query')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts Persian Iran locations and Shamsi-derived Gregorian ISO dates for persistence', async () => {
    await expect(validate(CreateParkDto, {
      code: 'PARK-ISF',
      name: 'شهرک صنعتی کاشان',
      province: 'اصفهان',
      city: 'کاشان',
      address: 'کاشان، شهرک صنعتی',
      phoneNumber: '03112345678',
      guardPhone: '09121234567',
    })).resolves.toMatchObject({ province: 'اصفهان', city: 'کاشان' });

    await expect(validate(CreateAdvertisementDto, {
      title: 'فروش تجهیزات',
      category: 'EQUIPMENT',
      province: 'تهران',
      city: 'تهران',
      content: 'توضیحات آگهی صنعتی',
      contactInfo: { phone: '09121234567' },
    })).resolves.toMatchObject({ province: 'تهران', city: 'تهران' });

    await expect(validate(CreateInvoiceDto, {
      factoryId: 'cm12345678901234567890123',
      description: 'هزینه خدمات ماهانه',
      amount: 1500000,
      dueDate: '2026-04-04',
    })).resolves.toMatchObject({ dueDate: '2026-04-04' });

    await expect(validate(CreateGatePassDto, {
      ...validGatePass,
      exitDate: '2026-09-03T10:30:00.000Z',
    })).resolves.toMatchObject({ exitDate: '2026-09-03T10:30:00.000Z' });

    await expect(validate(CreateAnnouncementDto, {
      title: 'اطلاعیه تست',
      content: 'متن اطلاعیه برای ثبت تاریخ انقضا',
      expiresAt: '2026-04-04T00:00:00.000Z',
    })).resolves.toMatchObject({ expiresAt: '2026-04-04T00:00:00.000Z' });
  });
});
