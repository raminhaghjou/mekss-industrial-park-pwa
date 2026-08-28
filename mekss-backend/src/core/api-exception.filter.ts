import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { resolveCorrelationId } from './request-context';

const HTTP_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
};

const prismaCode = (exception: unknown): string | undefined => {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) return exception.code;
  if (typeof exception === 'object' && exception !== null && 'code' in exception) {
    const code = (exception as { code?: unknown }).code;
    return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : undefined;
  }
  return undefined;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const correlationId = resolveCorrelationId(request);
    response.setHeader('X-Request-ID', correlationId);

    const mappedPrisma = this.mapPrisma(prismaCode(exception));
    if (mappedPrisma) {
      response.status(mappedPrisma.statusCode).json({ ...mappedPrisma, correlationId });
      return;
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
          correlationId,
        });
        return;
      }

      const body = exception.getResponse();
      const responseBody = typeof body === 'object' && body !== null
        ? body as { message?: string | string[]; error?: unknown }
        : undefined;
      const message = responseBody?.message ?? (typeof body === 'string' ? body : exception.message);
      const code = statusCode === HttpStatus.BAD_REQUEST && Array.isArray(message)
        ? 'VALIDATION_ERROR'
        : HTTP_CODES[statusCode] || 'HTTP_ERROR';
      const error = typeof responseBody?.error === 'string' ? responseBody.error : undefined;
      response.status(statusCode).json({ statusCode, message, ...(error ? { error } : {}), code, correlationId });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      correlationId,
    });
  }

  private mapPrisma(code?: string): { statusCode: number; message: string; code: string } | undefined {
    if (code === 'P2002') return { statusCode: HttpStatus.CONFLICT, message: 'A conflicting record already exists', code: 'UNIQUE_CONFLICT' };
    if (code === 'P2003') return { statusCode: HttpStatus.BAD_REQUEST, message: 'A related resource is invalid', code: 'RELATION_INVALID' };
    if (code === 'P2025') return { statusCode: HttpStatus.NOT_FOUND, message: 'Resource not found', code: 'NOT_FOUND' };
    return undefined;
  }
}
