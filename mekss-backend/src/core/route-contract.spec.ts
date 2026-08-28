import 'reflect-metadata';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AppModule } from '../app.module';
import { AuthController } from './auth.controller';
import { CoreModule } from './core.module';
import { HealthController } from './health.controller';
import { ManagementController, PaymentCallbackController } from './management.controller';

type ControllerType = {
  name: string;
  prototype: object;
};

const asPaths = (path: string | string[] | undefined): string[] => {
  if (Array.isArray(path)) return path;
  return [path ?? ''];
};

const normalizePath = (...parts: string[]): string => {
  const path = parts
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
  return `/${path}`;
};

const routesFor = (controller: ControllerType): string[] => {
  const controllerPaths = asPaths(Reflect.getMetadata(PATH_METADATA, controller));

  return Object.getOwnPropertyNames(controller.prototype).flatMap((memberName) => {
    if (memberName === 'constructor') return [];

    const handler = (controller.prototype as Record<string, unknown>)[memberName];
    if (typeof handler !== 'function') return [];

    const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
    if (requestMethod === undefined) return [];

    const methodPaths = asPaths(Reflect.getMetadata(PATH_METADATA, handler));
    const methodName = String(RequestMethod[requestMethod]);

    return controllerPaths.flatMap((controllerPath) =>
      methodPaths.map((methodPath) => `${methodName} ${normalizePath(controllerPath, methodPath)}`),
    );
  });
};

const moduleName = (entry: unknown): string | undefined => {
  if (typeof entry === 'function') return entry.name;
  if (!entry || typeof entry !== 'object' || !('module' in entry)) return undefined;

  const moduleReference = (entry as { module?: unknown }).module;
  return typeof moduleReference === 'function' ? moduleReference.name : undefined;
};

describe('active backend route contract', () => {
  it('keeps AppModule limited to configuration and the active CoreModule', async () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as unknown[];
    const resolvedImports = await Promise.all(imports);
    const importedModuleNames = resolvedImports.map(moduleName).filter((name): name is string => Boolean(name)).sort();

    expect(importedModuleNames).toEqual(['ConfigModule', 'CoreModule']);
  });

  it('does not register inactive parallel controllers', () => {
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, CoreModule) as ControllerType[];

    expect(controllers).toEqual([
      AuthController,
      HealthController,
      ManagementController,
      PaymentCallbackController,
    ]);
  });

  it('preserves every active HTTP endpoint', () => {
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, CoreModule) as ControllerType[];
    const routes = controllers.flatMap(routesFor).sort();

    expect(routes).toEqual(
      [
        'GET /api/v1/advertisements',
        'GET /api/v1/advertisements/creation-scope',
        'GET /api/v1/advertisements/managed',
        'GET /api/v1/advertisements/managed/:id',
        'GET /api/v1/advertisements/managed/history',
        'GET /api/v1/advertisements/managed/pending',
        'GET /api/v1/analytics/dashboard',
        'GET /api/v1/announcements',
        'GET /api/v1/announcements/managed',
        'GET /api/v1/auth/me',
        'GET /api/v1/emergency',
        'GET /api/v1/factories',
        'GET /api/v1/factories/:id',
        'GET /api/v1/factories/managed',
        'GET /api/v1/factories/managed/:id',
        'GET /api/v1/factories/management-scope',
        'GET /api/v1/gate-passes',
        'GET /api/v1/gate-passes/:id',
        'GET /api/v1/industrial-parks',
        'GET /api/v1/industrial-parks/:id',
        'GET /api/v1/invoices',
        'GET /api/v1/invoices/payment/callback',
        'GET /api/v1/messages/inbox',
        'GET /api/v1/reports',
        'GET /api/v1/requests',
        'GET /api/v1/sms/health',
        'GET /api/v1/users',
        'GET /api/v1/users/:id',
        'GET /health',
        'GET /ready',
        'DELETE /api/v1/announcements/:id',
        'DELETE /api/v1/industrial-parks/:id',
        'DELETE /api/v1/users/:id',
        'PATCH /api/v1/users/:id',
        'POST /api/v1/advertisements',
        'POST /api/v1/advertisements/:id/approve',
        'POST /api/v1/announcements',
        'POST /api/v1/auth/change-password',
        'POST /api/v1/auth/login',
        'POST /api/v1/auth/logout',
        'POST /api/v1/auth/otp/send',
        'POST /api/v1/auth/otp/verify',
        'POST /api/v1/auth/password/forgot',
        'POST /api/v1/auth/password/reset',
        'POST /api/v1/auth/refresh',
        'POST /api/v1/auth/register',
        'POST /api/v1/emergency',
        'POST /api/v1/emergency/:id/acknowledge',
        'POST /api/v1/emergency/:id/resolve',
        'POST /api/v1/factories',
        'POST /api/v1/factories/:id/approve',
        'POST /api/v1/factories/:id/reject',
        'POST /api/v1/gate-passes',
        'POST /api/v1/gate-passes/:id/approve',
        'POST /api/v1/gate-passes/:id/deny',
        'POST /api/v1/gate-passes/:id/reject',
        'POST /api/v1/gate-passes/:id/verify',
        'POST /api/v1/industrial-parks',
        'POST /api/v1/invoices',
        'POST /api/v1/invoices/:id/pay',
        'POST /api/v1/messages/:id/read',
        'POST /api/v1/messages/batch',
        'POST /api/v1/requests',
        'POST /api/v1/requests/:id/approve',
        'POST /api/v1/requests/:id/reject',
        'POST /api/v1/users',
        'POST /api/v1/users/:id/activate',
        'POST /api/v1/users/:id/deactivate',
        'POST /api/v1/users/:id/reset-password',
        'PUT /api/v1/announcements/:id',
        'PUT /api/v1/auth/me',
        'PUT /api/v1/factories/:id',
        'PUT /api/v1/industrial-parks/:id',
      ].sort(),
    );
  });
});
