import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from './prisma.service';

export const PUBLIC_ROUTE_KEY = 'publicRoute';
export const Public = () => SetMetadata(PUBLIC_ROUTE_KEY, true);
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export type AuthenticatedUser = { id: string; role: Role; phoneNumber: string };
type AccessTokenPayload = { sub: string; sessionVersion?: number };

/** Verifies a bearer access token against the live user record (shared by HTTP and WebSocket auth). */
export async function verifyAccessToken(jwt: JwtService, prisma: PrismaService, token: string | undefined): Promise<AuthenticatedUser> {
  if (!token) throw new UnauthorizedException('Authentication is required');

  let payload: AccessTokenPayload;
  try {
    payload = await jwt.verifyAsync<AccessTokenPayload>(token);
  } catch {
    throw new UnauthorizedException('Invalid or expired access token');
  }

  if (!payload || typeof payload.sub !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(payload.sub)) {
    throw new UnauthorizedException('Invalid or expired access token');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, phoneNumber: true, isActive: true, isApproved: true, sessionVersion: true },
  });
  const tokenSessionVersion = payload.sessionVersion ?? 0;
  const currentSessionVersion = user?.sessionVersion ?? 0;
  if (!user?.isActive || !user.isApproved || !Number.isInteger(tokenSessionVersion) || tokenSessionVersion !== currentSessionVersion) {
    throw new UnauthorizedException('Invalid or expired access token');
  }
  return { id: user.id, role: user.role, phoneNumber: user.phoneNumber };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector = new Reflector(),
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler?.();
    const controller = context.getClass?.();
    const isPublic = handler && controller
      ? this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [handler, controller])
      : false;
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const value = request.headers.authorization;
    const token = typeof value === 'string' && value.startsWith('Bearer ') ? value.slice(7) : undefined;
    request.user = await verifyAccessToken(this.jwt, this.prisma, token);
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles?.length) return true;
    const request = context.switchToHttp().getRequest();
    if (!roles.includes(request.user?.role)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }
    return true;
  }
}
