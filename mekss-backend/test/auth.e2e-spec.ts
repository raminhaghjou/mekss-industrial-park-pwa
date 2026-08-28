import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OtpPurpose, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/core/prisma.service';
import { requestContextMiddleware } from '../src/core/request-context';

const createTestApp = async (): Promise<INestApplication> => {
  const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication();
  app.use(requestContextMiddleware);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  return app;
};

describe('AuthController active contract (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'AuthContract123';
  const loginPhone = '09128888000';
  const otpPhone = '09128888001';
  const registrationPhone = '09128888002';
  const otp = '123456';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const [passwordHash, otpHash] = await Promise.all([bcrypt.hash(password, 4), bcrypt.hash(otp, 4)]);
    const loginUser = await prisma.user.create({
      data: {
        id: 'auth-contract-login-user', phoneNumber: loginPhone, password: passwordHash,
        name: 'Approved login user', role: Role.EMPLOYEE, isApproved: true, isActive: true,
      },
    });
    const otpUser = await prisma.user.create({
      data: {
        id: 'auth-contract-otp-user', phoneNumber: otpPhone, password: passwordHash,
        name: 'Approved OTP user', role: Role.EMPLOYEE, isApproved: true, isActive: true,
      },
    });
    await prisma.otpChallenge.create({
      data: {
        id: 'auth-contract-otp-challenge', phoneNumber: otpPhone, userId: otpUser.id,
        purpose: OtpPurpose.LOGIN, codeHash: otpHash, expiresAt: new Date(Date.now() + 60_000),
      },
    });
    expect(loginUser.id).toBe('auth-contract-login-user');
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('registers a canonical pending employee and never returns credentials', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      phoneNumber: registrationPhone,
      password,
      name: 'Test User',
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      message: 'Registration submitted for approval',
      user: { phoneNumber: registrationPhone, name: 'Test User', role: Role.EMPLOYEE, isApproved: false },
    });
    expect(response.body.user.id).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toMatch(/"password"|"sessionVersion"/);
  });

  it('rejects invalid registration input before persistence', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      phoneNumber: 'invalid-phone', password, name: 'Test User',
    });
    expect(response.status).toBe(400);
    await expect(prisma.user.count({ where: { name: 'Test User', phoneNumber: 'invalid-phone' } })).resolves.toBe(0);
  });

  it('logs in an approved active user and rejects incorrect credentials', async () => {
    const success = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ phoneNumber: loginPhone, password });
    expect(success.status).toBe(200);
    expect(success.body).toMatchObject({ user: { id: 'auth-contract-login-user', phoneNumber: loginPhone } });
    expect(success.body.accessToken).toEqual(expect.any(String));
    expect(success.body.refreshToken).toEqual(expect.any(String));

    const failure = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ phoneNumber: loginPhone, password: 'WrongPassword' });
    expect(failure.status).toBe(401);
    expect(failure.body).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('verifies the active otp/verify contract and consumes the challenge once', async () => {
    const success = await request(app.getHttpServer()).post('/api/v1/auth/otp/verify').send({ phoneNumber: otpPhone, otp });
    expect(success.status).toBe(200);
    expect(success.body).toMatchObject({ user: { id: 'auth-contract-otp-user', phoneNumber: otpPhone } });
    expect(success.body.accessToken).toEqual(expect.any(String));
    expect(success.body.refreshToken).toEqual(expect.any(String));

    const duplicate = await request(app.getHttpServer()).post('/api/v1/auth/otp/verify').send({ phoneNumber: otpPhone, otp });
    expect(duplicate.status).toBe(400);
  });
});
