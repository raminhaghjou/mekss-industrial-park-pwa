import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('/auth/register (POST)', () => {
    it('should register a new user', () => {
      const registerDto = {
        phoneNumber: '09123456789',
        password: 'Test@123456',
        name: 'Test User',
        role: 'FACTORY_OWNER',
      };

      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('phoneNumber', registerDto.phoneNumber);
          expect(res.body).toHaveProperty('name', registerDto.name);
        });
    });

    it('should not register with invalid phone number', () => {
      const registerDto = {
        phoneNumber: 'invalid-phone',
        password: 'Test@123456',
        name: 'Test User',
        role: 'FACTORY_OWNER',
      };

      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerDto)
        .expect(400);
    });
  });

  describe('/auth/login (POST)', () => {
    it('should login with valid credentials', () => {
      const loginDto = {
        phoneNumber: '09123456789',
        password: 'Test@123456',
      };

      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginDto)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body).toHaveProperty('user');
        });
    });

    it('should not login with invalid credentials', () => {
      const loginDto = {
        phoneNumber: '09123456789',
        password: 'WrongPassword',
      };

      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginDto)
        .expect(401);
    });
  });

  describe('/auth/verify-otp (POST)', () => {
    it('should verify OTP', () => {
      const verifyOtpDto = {
        phoneNumber: '09123456789',
        code: '123456',
      };

      return request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send(verifyOtpDto)
        .expect(200);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
