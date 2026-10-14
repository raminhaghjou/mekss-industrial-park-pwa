import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

const config = { get: jest.fn(() => undefined) } as any;

const storedUser = async (password = 'OldPass123') => ({
  id: 'user-1',
  phoneNumber: '09120000000',
  username: null,
  name: 'کاربر',
  nationalId: null,
  email: null,
  role: Role.EMPLOYEE,
  isApproved: true,
  isActive: true,
  mustChangePassword: true,
  avatar: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: null,
  employeeOfFactoryId: null,
  canApproveRequestTypes: [],
  messagingRestricted: false,
  defaultDriver: null,
  sessionVersion: 3,
  password: await bcrypt.hash(password, 4),
});

const buildTx = (user: any) => ({
  $queryRaw: jest.fn().mockResolvedValue([{ id: user.id }]),
  user: {
    findUnique: jest.fn().mockResolvedValue(user),
    update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...user, ...data, sessionVersion: user.sessionVersion + 1 })),
  },
  refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }), create: jest.fn().mockResolvedValue({}) },
});

describe('AuthService password flows', () => {
  it('changePassword revokes old sessions and returns a fresh pair for the current device', async () => {
    const tx = buildTx(await storedUser());
    const prisma = { $transaction: jest.fn((fn) => fn(tx)) } as any;
    const jwt = { signAsync: jest.fn().mockResolvedValue('new-access') } as any;
    const audit = { record: jest.fn() } as any;
    const service = new AuthService(prisma, jwt, config, {} as any, audit);

    const session = await service.changePassword('user-1', 'OldPass123', 'NewPass456', { ipAddress: '1.2.3.4' });

    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1', revokedAt: null } }));
    expect(tx.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(jwt.signAsync).toHaveBeenCalledWith(expect.objectContaining({ sub: 'user-1', sessionVersion: 4 }));
    expect(session.accessToken).toBe('new-access');
    expect(session.refreshToken).toEqual(expect.any(String));
    expect(session.user).not.toHaveProperty('password');
    expect(session.mustChangePassword).toBe(false);
  });

  it('changePassword answers 400 (not 401) for a wrong current password', async () => {
    const tx = buildTx(await storedUser());
    const prisma = { $transaction: jest.fn((fn) => fn(tx)) } as any;
    const service = new AuthService(prisma, { signAsync: jest.fn() } as any, config, {} as any, { record: jest.fn() } as any);

    await expect(service.changePassword('user-1', 'wrong-pass1', 'NewPass456')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('forgot-password rolls the temporary password back when the SMS cannot be sent', async () => {
    const tx = buildTx(await storedUser());
    let committed = false;
    const prisma = {
      $transaction: jest.fn(async (fn) => { const result = await fn(tx); committed = true; return result; }),
    } as any;
    const sms = { sendText: jest.fn().mockRejectedValue(new ServiceUnavailableException('sms down')) } as any;
    const service = new AuthService(prisma, { signAsync: jest.fn() } as any, config, sms, { record: jest.fn() } as any);
    jest.spyOn(service as any, 'consumeOtp').mockResolvedValue({ id: 'user-1' });

    await expect(service.resetPasswordWithGeneratedTemp('09120000000', '123456')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(sms.sendText).toHaveBeenCalledTimes(1);
    expect(committed).toBe(false);
  });
});
