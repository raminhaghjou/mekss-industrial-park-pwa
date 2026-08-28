import { Injectable } from '@nestjs/common';
import { AuditResult, Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

type AuditDatabase = Pick<Prisma.TransactionClient, 'auditLog'>;
type JsonLike = Prisma.InputJsonValue | undefined;

const SENSITIVE_KEY = /(password|token|secret|otp|hash|credential|authorization)/i;
const REDACTED = '[REDACTED]';

const redact = (value: unknown, key?: string): Prisma.InputJsonValue => {
  if (key && SENSITIVE_KEY.test(key)) return REDACTED;
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [entryKey, redact(entryValue, entryKey)]));
  }
  return String(value);
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    userId?: string;
    actorIdentifier?: string;
    action: string;
    entity: string;
    entityId: string;
    changes?: JsonLike;
    result?: AuditResult;
    correlationId?: string;
    ipAddress?: string;
    userAgent?: string;
  }, db?: AuditDatabase): Promise<void> {
    await (db ?? this.prisma).auditLog.create({
      data: {
        userId: input.userId,
        actorIdentifier: input.actorIdentifier || input.userId || 'system',
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        changes: input.changes === undefined ? undefined : redact(input.changes),
        result: input.result || AuditResult.SUCCESS,
        correlationId: input.correlationId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }
}
