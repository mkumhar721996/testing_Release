import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { ActivationService } from '../src/auth/activation.service';
import { InvalidCredentialsError } from '../src/auth/auth.errors';
import { Clock } from '../src/auth/clock';
import { COGNITO_AUTH } from '../src/auth/cognito-auth.port';
import { User } from '../src/auth/entities/user.entity';
import { FakeClock, fakeCognito } from '../src/auth/testing/fakes';

const GENERIC = { message: 'Incorrect email or password.' };
const t0 = new Date('2026-01-01T00:00:00Z');
const PASSWORD = 'test-password';

process.env.SESSION_ENCRYPTION_KEY ??= 'test-encryption-key';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let clock: FakeClock;
  let cognito: ReturnType<typeof fakeCognito>;
  let ds: DataSource;
  let activation: ActivationService;
  let n = 0;

  const makeUser = (status: 'active' | 'pending' = 'active') =>
    ds.getRepository(User).save({
      email: `user${Date.now()}-${n++}@example.com`,
      cognitoSub: 'sub',
      status,
      failedSignInCount: 0,
      lockStartedAt: null,
    });

  beforeAll(async () => {
    clock = new FakeClock(t0);
    cognito = fakeCognito();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(COGNITO_AUTH)
      .useValue(cognito)
      .overrideProvider(Clock)
      .useValue(clock)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    ds = app.get(DataSource);
    activation = app.get(ActivationService);
  });

  beforeEach(() => {
    clock.set(t0);
    cognito.signIn.mockReset();
    cognito.signIn.mockResolvedValue({ refreshToken: 'r', sub: 'sub' });
  });

  afterAll(async () => {
    await app?.close();
  });

  const signIn = (email: string, password = PASSWORD) =>
    request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email, password });

  it('signs in, probes the session and signs out (AC3, AC4, AC8)', async () => {
    const user = await makeUser();
    const agent = request.agent(app.getHttpServer());
    const res = await agent
      .post('/auth/sign-in')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    expect(res.headers['set-cookie'][0]).toMatch(/^sid=.*HttpOnly/);
    expect(res.body).toEqual({
      status: 'signed_in',
      user: { id: user.id, email: user.email },
    });
    await agent.get('/auth/session').expect(200);
    await agent.post('/auth/sign-out').expect(204);
    await agent.get('/auth/session').expect(401);
    expect(cognito.signOut).toHaveBeenCalledWith('r');
  });

  it('requires sign-in again after 30 minutes idle (AC5)', async () => {
    const user = await makeUser();
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/sign-in')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    await agent.get('/auth/session').expect(200);
    clock.advance(30 * 60_000);
    const res = await agent.get('/auth/session').expect(401);
    expect(res.body.code).toBe('session_expired');
  });

  it('refuses a wrong password without a cookie (AC6)', async () => {
    const user = await makeUser();
    cognito.signIn.mockRejectedValue(new InvalidCredentialsError());
    const res = await signIn(user.email, 'wrong').expect(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('refuses an unregistered username without a cookie', async () => {
    const res = await signIn('nobody@example.com', 'anything').expect(401);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.body).toEqual(GENERIC);
  });

  it('refuses an empty password without a cookie or a Cognito call', async () => {
    const user = await makeUser();
    const res = await signIn(user.email, '').expect(401);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.body).toEqual(GENERIC);
    expect(cognito.signIn).not.toHaveBeenCalled();
  });

  it('gives an identical refusal for every failure reason (AC7)', async () => {
    const wrongUser = await makeUser();
    const pending = await makeUser('pending');
    const locked = await makeUser();
    cognito.signIn.mockRejectedValue(new InvalidCredentialsError());
    const bodies: unknown[] = [];
    bodies.push((await signIn(wrongUser.email, 'wrong')).body);
    bodies.push((await signIn('nobody@example.com')).body);
    bodies.push((await signIn(pending.email)).body);
    for (let i = 0; i < 5; i++) await signIn(locked.email, 'wrong');
    // Cognito would accept the password now, so only the lock can refuse it.
    cognito.signIn.mockResolvedValue({ refreshToken: 'r', sub: 'sub' });
    const lockedRes = await signIn(locked.email).expect(401);
    bodies.push(lockedRes.body);
    for (const b of bodies) expect(b).toEqual(GENERIC);
  });

  it('activates a pending account from an unused link (AC1, AC2)', async () => {
    const user = await makeUser('pending');
    const { token } = await activation.issue(user.id);
    await request(app.getHttpServer())
      .post('/auth/activate')
      .send({ token, password: PASSWORD })
      .expect(200, { status: 'activated' });
    await request(app.getHttpServer())
      .post('/auth/activate')
      .send({ token, password: PASSWORD })
      .expect(400);
  });

  it('refuses an expired link and asks for a new email (AC9, AC10)', async () => {
    const user = await makeUser('pending');
    const { token } = await activation.issue(user.id);
    clock.advance(24 * 60 * 60_000 + 1);
    const res = await request(app.getHttpServer())
      .post('/auth/activate')
      .send({ token, password: PASSWORD })
      .expect(410);
    expect(res.body).toEqual({
      code: 'activation_link_expired',
      message:
        'This activation link has expired. Request a new activation email.',
    });
  });
});
