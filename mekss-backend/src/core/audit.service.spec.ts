import { AuditResult } from '@prisma/client';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  const prisma = { auditLog: { create: jest.fn() } } as any;
  const transaction = { auditLog: { create: jest.fn() } } as any;
  const service = new AuditService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('uses the supplied transaction client and records actor, result, and correlation metadata', async () => {
    await service.record({
      userId: 'actor-1',
      actorIdentifier: 'admin:actor-1',
      action: 'UPDATED',
      entity: 'User',
      entityId: 'user-2',
      result: AuditResult.FAILURE,
      correlationId: 'request-1',
    }, transaction);

    expect(transaction.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: 'actor-1',
      actorIdentifier: 'admin:actor-1',
      result: AuditResult.FAILURE,
      correlationId: 'request-1',
    }) });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('recursively redacts credential-like keys without mutating safe audit context', async () => {
    const changes = {
      name: 'safe',
      password: 'plain',
      nested: {
        accessToken: 'token-value',
        items: [{ otpCode: '123456', label: 'visible' }],
        Authorization: 'Bearer private',
        profile: { secretAnswer: 'private', count: 2 },
      },
    } as any;

    await service.record({ action: 'TEST', entity: 'Entity', entityId: 'entity-1', changes });

    const data = prisma.auditLog.create.mock.calls[0][0].data;
    expect(data.actorIdentifier).toBe('system');
    expect(data.result).toBe(AuditResult.SUCCESS);
    expect(data.changes).toEqual({
      name: 'safe',
      password: '[REDACTED]',
      nested: {
        accessToken: '[REDACTED]',
        items: [{ otpCode: '[REDACTED]', label: 'visible' }],
        Authorization: '[REDACTED]',
        profile: { secretAnswer: '[REDACTED]', count: 2 },
      },
    });
    expect(changes.password).toBe('plain');
  });
});
