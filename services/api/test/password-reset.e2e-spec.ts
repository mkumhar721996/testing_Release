import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { Clock } from '../src/auth/clock';
import { COGNITO_AUTH } from '../src/auth/cognito-auth.port';
import { User } from '../src/auth/entities/user.entity';
import { PasswordResetNotifier } from '../src/auth/password-reset.notifier';
import {
  FakeClock,
  statefulCognito,
} from '../src/auth/testing/fakes';

const t0 = new Date('2026-01-01T00:00:00Z');
const EMAIL = `reset${Date.now()}@example.com`;
const OLD = 'old-password';
const NEW = 'new-password-1';

process.env.SESSION_ENCRYPTION_KEY ??= 'test-encryption-key';

describe('Password reset (e2e)', () => {
  let app: INestApplication;
  const notifier = { send: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(COGNITO_AUTH)
      .useValue(statefulCognito({ [EMAIL]: OLD }))
      .overrideProvider(Clock)
      .useValue(new FakeClock(t0))
      .overrideProvider(PasswordResetNotifier)
      .useValue(notifier)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    await app.get(DataSource).getRepository(User).save({
      email: EMAIL,
      cognitoSub: 'sub',
      status: 'active',
      failedSignInCount: 0,
      lockStartedAt: null,
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const post = (path: string, body: unknown) =>
    request(app.getHttpServer()).post(path).send(body as object);

  it('signs in with the new password and refuses the old one (AC1, AC2)', async () => {
    await post('/auth/password-reset/request', { email: EMAIL }).expect(200, {
      status: 'requested',
    });
    await post('/auth/password-reset/request', {
      email: 'nobody@example.com',
    }).expect(200, { status: 'requested' });
    await post('/auth/password-reset/request', {}).expect(200);
    expect(notifier.send).toHaveBeenCalledTimes(1);
    const token = notifier.send.mock.calls[0][1];

    await post('/auth/password-reset/confirm', {
      token,
      password: NEW,
    }).expect(200, { status: 'password_reset' });
    await post('/auth/sign-in', { email: EMAIL, password: NEW }).expect(200);
    await post('/auth/sign-in', { email: EMAIL, password: OLD }).expect(401);
    await post('/auth/password-reset/confirm', {
      token,
      password: NEW,
    }).expect(400);
  });
});
