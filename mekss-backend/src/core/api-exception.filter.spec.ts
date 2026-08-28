import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

const harness = (requestId?: string) => {
  const response = {
    setHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  } as any;
  response.status.mockReturnValue(response);
  const request = { header: jest.fn().mockReturnValue(requestId) } as any;
  const host = { switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }) } as any;
  return { response, host };
};

describe('ApiExceptionFilter', () => {
  const filter = new ApiExceptionFilter();

  it('preserves legacy fields and adds a stable code and correlation id for validation errors', () => {
    const { response, host } = harness('request-123');
    filter.catch(new BadRequestException(['name must be longer']), host);

    expect(response.setHeader).toHaveBeenCalledWith('X-Request-ID', 'request-123');
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: ['name must be longer'],
      error: 'Bad Request',
      code: 'VALIDATION_ERROR',
      correlationId: 'request-123',
    });
  });

  it('normalizes HttpException 5xx responses without disclosing their message', () => {
    const { response, host } = harness('server-error-request');
    filter.catch(new InternalServerErrorException('database password=private'), host);

    const body = response.json.mock.calls[0][0];
    expect(response.status).toHaveBeenCalledWith(500);
    expect(body).toEqual({
      statusCode: 500,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      correlationId: 'server-error-request',
    });
    expect(JSON.stringify(body)).not.toMatch(/database|password|private/);
  });

  it.each([
    ['P2002', 409, 'UNIQUE_CONFLICT'],
    ['P2003', 400, 'RELATION_INVALID'],
    ['P2025', 404, 'NOT_FOUND'],
  ])('maps Prisma %s to a safe response', (prismaCode, statusCode, code) => {
    const { response, host } = harness();
    filter.catch({ code: prismaCode, message: 'SQL and private values' }, host);

    expect(response.status).toHaveBeenCalledWith(statusCode);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ statusCode, code, correlationId: expect.any(String) }));
    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain('SQL');
  });

  it('returns a non-disclosing 500 and replaces unsafe request ids', () => {
    const { response, host } = harness('unsafe request id\r\nsecret');
    filter.catch(new Error('stack SQL password=private'), host);

    const body = response.json.mock.calls[0][0];
    expect(response.status).toHaveBeenCalledWith(500);
    expect(body).toMatchObject({ statusCode: 500, message: 'Internal server error', code: 'INTERNAL_ERROR' });
    expect(body.correlationId).not.toBe('unsafe request id\r\nsecret');
    expect(JSON.stringify(body)).not.toMatch(/stack|SQL|password|private/);
  });
});
