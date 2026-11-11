import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ActivationService } from './activation.service';
import { AuthController } from './auth.controller';
import { EmailAlreadyRegisteredError, PasswordPolicyError } from './auth.errors';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { RegistrationService } from './registration.service';
import { SessionGuard } from './session.guard';

describe('AuthController register', () => {
  let app: INestApplication;
  const registration = { register: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: ActivationService, useValue: {} },
        { provide: PasswordResetService, useValue: {} },
        { provide: RegistrationService, useValue: registration },
      ],
    })
      .overrideGuard(SessionGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => registration.register.mockReset());

  const post = (body: unknown) =>
    request(app.getHttpServer()).post('/auth/register').send(body as object);

  it('returns 201 when the account is created', async () => {
    registration.register.mockResolvedValue({ id: '1', email: 'a@example.com' });
    await post({ email: 'a@example.com', password: 'test-password' }).expect(201);
    expect(registration.register).toHaveBeenCalledWith(
      'a@example.com',
      'test-password',
    );
  });

  it('returns 400 registration_invalid when the password is missing', async () => {
    const res = await post({ email: 'a@example.com' }).expect(400);
    expect(res.body.code).toBe('registration_invalid');
    expect(registration.register).not.toHaveBeenCalled();
  });

  it('returns 400 password_policy for a rejected password', async () => {
    registration.register.mockRejectedValue(new PasswordPolicyError());
    const res = await post({ email: 'a@example.com', password: 'weak' }).expect(
      400,
    );
    expect(res.body.code).toBe('password_policy');
  });

  it('returns 409 email_already_registered for a duplicate email', async () => {
    registration.register.mockRejectedValue(new EmailAlreadyRegisteredError());
    const res = await post({
      email: 'a@example.com',
      password: 'test-password',
    }).expect(409);
    expect(res.body.code).toBe('email_already_registered');
  });
});
