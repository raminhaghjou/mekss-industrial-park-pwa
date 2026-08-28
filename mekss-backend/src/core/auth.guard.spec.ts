import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { JwtAuthGuard, RolesGuard } from './auth.guard';

describe('authentication guards', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const prisma = { user: { findUnique: jest.fn() } } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: Role.SUPER_ADMIN, phoneNumber: '09120000000', isActive: true, isApproved: true, sessionVersion: 0 });
  });

  const contextFor = (authorization?: string) => {
    const request: any = { headers: authorization ? { authorization } : {} };
    return {
      request,
      context: {
        getHandler: () => contextFor,
        getClass: () => JwtAuthGuard,
        switchToHttp: () => ({ getRequest: () => request }),
      } as any,
    };
  };

  it('verifies the token and attaches the current database identity rather than stale claims', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: Role.PARK_MANAGER, phoneNumber: '09350000000', isActive: true, isApproved: true, sessionVersion: 0 });
    const token = await jwt.signAsync({ sub: 'user-1', role: Role.SUPER_ADMIN, phoneNumber: '09120000000' });
    const { request, context } = contextFor(`Bearer ${token}`);

    await expect(new JwtAuthGuard(jwt, prisma).canActivate(context)).resolves.toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, role: true, phoneNumber: true, isActive: true, isApproved: true, sessionVersion: true },
    });
    expect(request.user).toEqual({ id: 'user-1', role: Role.PARK_MANAGER, phoneNumber: '09350000000' });
  });

  it.each([
    ['deleted', null],
    ['inactive', { id: 'user-1', role: Role.SUPER_ADMIN, phoneNumber: '09120000000', isActive: false, isApproved: true, sessionVersion: 0 }],
    ['unapproved', { id: 'user-1', role: Role.SUPER_ADMIN, phoneNumber: '09120000000', isActive: true, isApproved: false }],
  ])('rejects a %s current user with the same non-disclosing 401', async (_case, user) => {
    prisma.user.findUnique.mockResolvedValue(user);
    const token = await jwt.signAsync({ sub: 'user-1', role: Role.SUPER_ADMIN, phoneNumber: '09120000000' });
    const { context } = contextFor(`Bearer ${token}`);

    await expect(new JwtAuthGuard(jwt, prisma).canActivate(context)).rejects.toMatchObject({
      status: 401,
      message: 'Invalid or expired access token',
    });
  });

  it('rejects an access token issued for an older session version', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1', role: Role.SUPER_ADMIN, phoneNumber: '09120000000', isActive: true, isApproved: true, sessionVersion: 2,
    });
    const token = await jwt.signAsync({ sub: 'user-1', sessionVersion: 1 });
    const { context } = contextFor(`Bearer ${token}`);

    await expect(new JwtAuthGuard(jwt, prisma).canActivate(context)).rejects.toMatchObject({
      status: 401,
      message: 'Invalid or expired access token',
    });
  });

  it('does not collapse database failures into invalid-token responses', async () => {
    const failure = new Error('database unavailable');
    prisma.user.findUnique.mockRejectedValue(failure);
    const token = await jwt.signAsync({ sub: 'user-1', role: Role.SUPER_ADMIN, phoneNumber: '09120000000' });
    const { context } = contextFor(`Bearer ${token}`);

    await expect(new JwtAuthGuard(jwt, prisma).canActivate(context)).rejects.toBe(failure);
  });

  it('rejects a missing or invalid bearer token without querying the database', async () => {
    for (const authorization of [undefined, 'Basic abc', 'Bearer invalid-token']) {
      const { context } = contextFor(authorization);
      await expect(new JwtAuthGuard(jwt, prisma).canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    }
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects correctly signed tokens with an invalid subject before querying the database', async () => {
    for (const sub of [undefined, '', 42, 'invalid subject']) {
      const token = await jwt.signAsync({ sub });
      const { context } = contextFor(`Bearer ${token}`);
      await expect(new JwtAuthGuard(jwt, prisma).canActivate(context)).rejects.toMatchObject({
        status: 401,
        message: 'Invalid or expired access token',
      });
    }
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('allows only explicitly public handlers to bypass bearer authentication', async () => {
    const { context } = contextFor();
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) } as any;

    await expect(new JwtAuthGuard(jwt, prisma, reflector).canActivate(context)).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('allows authorized roles and explicitly throws ForbiddenException for other roles', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([Role.SUPER_ADMIN]) } as any;
    const guard = new RolesGuard(reflector);
    const context = (role: Role) => ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    }) as any;

    expect(guard.canActivate(context(Role.SUPER_ADMIN))).toBe(true);
    expect(() => guard.canActivate(context(Role.EMPLOYEE))).toThrow(ForbiddenException);
  });
});
