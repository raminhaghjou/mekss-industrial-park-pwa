import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { JwtAuthGuard, RolesGuard } from './auth.guard';

describe('authentication guards', () => {
  const jwt = new JwtService({ secret: 'test-secret' });

  it('accepts a valid bearer token and attaches the canonical user payload', async () => {
    const guard = new JwtAuthGuard(jwt);
    const token = await jwt.signAsync({ sub: 'user-1', role: Role.SUPER_ADMIN, phoneNumber: '09120000000' });
    const request: Record<string, unknown> = { headers: { authorization: `Bearer ${token}` } };
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'user-1', role: Role.SUPER_ADMIN, phoneNumber: '09120000000' });
  });

  it('rejects a missing bearer token', async () => {
    const guard = new JwtAuthGuard(jwt);
    const context = { switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }) } as any;
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('enforces roles only when metadata requires them', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([Role.SUPER_ADMIN]) } as any;
    const guard = new RolesGuard(reflector);
    const adminContext = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.SUPER_ADMIN } }) }),
    } as any;
    const employeeContext = {
      ...adminContext,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.EMPLOYEE } }) }),
    } as any;

    expect(guard.canActivate(adminContext)).toBe(true);
    expect(guard.canActivate(employeeContext)).toBe(false);
  });
});
