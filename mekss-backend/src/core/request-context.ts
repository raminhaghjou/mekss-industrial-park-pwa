import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { AsyncLocalStorage } from 'async_hooks';

type RequestStore = { correlationId: string };
type CorrelatedRequest = Request & { correlationId?: string };

export const requestContext = new AsyncLocalStorage<RequestStore>();

const validRequestId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value);

export const resolveCorrelationId = (request: CorrelatedRequest): string => {
  if (validRequestId(request.correlationId)) return request.correlationId;
  const supplied = request.header('x-request-id');
  return validRequestId(supplied) ? supplied : randomUUID();
};

export const requestContextMiddleware = (request: CorrelatedRequest, response: Response, next: NextFunction): void => {
  const correlationId = resolveCorrelationId(request);
  request.correlationId = correlationId;
  response.setHeader('X-Request-ID', correlationId);
  requestContext.run({ correlationId }, next);
};

export const currentCorrelationId = (): string | undefined => requestContext.getStore()?.correlationId;
