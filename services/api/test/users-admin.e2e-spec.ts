import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { ACTIVATION_NOTIFIER } from '../src/auth/activation.notifier';
import { COGNITO_AUTH } from '../src/auth/cognito-auth.port';
import { User } from '../src/auth/entities/user.entity';
import { Role } from '../src/auth/role';
import { fakeCognito } from '../src/auth/testing/fakes';

process.env.SESSION_ENCRYPTION_KEY ??= 'test-encryption-key';

describe('User administration (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let n = 0;
  const cognito = fakeCognito();
  const notifier = { notify: jest.fn().mockResolvedValue(undefined) };

  const makeUser = (role: Role) =>
    ds.getRepository(User).save({
      email: `admin${Date.now()}-${n++}@example.com`,
      cognitoSub: 'sub',
      status: 'active',
      role,
      failedSignInCount: 0,
      lockStartedAt: null,
    });

  const signedIn = async (role: Role) => {
    const user = await makeUser(role);
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/sign-in')
      .send({ email: user.email, password: 'test-password' });
    return { agent, user };
  };

  beforeAll(async () => {
    cognito.signIn.mockResolvedValue({ refreshToken: 'refresh-token', sub: 'sub' });
    cognito.createUser.mockResolvedValue({ sub: 'new-sub' });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(COGNITO_AUTH)
      .useValue(cognito)
      .overrideProvider(ACTIVATION_NOTIFIER)
      .useValue(notifier)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    ds = app.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each<Role>(['employee', 'manager', 'read_only_executive'])(
    'shows %s no user administration (AC8)',
    async (role) => {
      const { agent, user } = await signedIn(role);
      await agent.get('/admin/users').expect(403);
      await agent
        .post('/admin/users/invite')
        .send({ email: 'x@x.com', displayName: 'X', role: 'employee' })
        .expect(403);
      await agent.post(`/admin/users/${user.id}/deactivate`).expect(403);
    },
  );

  it('lists, invites, changes role, deactivates and reactivates (AC1, 2, 4, 6, 7)', async () => {
    const { agent } = await signedIn('hr_admin');
    const target = await makeUser('employee');

    const list = await agent.get('/admin/users').expect(200);
    expect(list.body.map((u: { id: string }) => u.id)).toContain(target.id);

    await agent
      .post('/admin/users/invite')
      .send({ email: 'New@X.com', displayName: 'New Joiner', role: 'manager' })
      .expect(201);
    const after = (await agent.get('/admin/users')).body;
    expect(after.find((u: { email: string }) => u.email === 'new@x.com')).toMatchObject({
      role: 'manager',
      status: 'pending',
    });
    expect(notifier.notify).toHaveBeenCalledTimes(1);

    await agent.patch(`/admin/users/${target.id}/role`).send({ role: 'hr_admin' }).expect(200);
    await agent.patch(`/admin/users/${target.id}/role`).send({ role: ['manager', 'employee'] }).expect(400);
    await agent.post(`/admin/users/${target.id}/deactivate`).expect(201);
    expect((await ds.getRepository(User).findOneByOrFail({ id: target.id })).status).toBe('deactivated');
    await agent.post(`/admin/users/${target.id}/reactivate`).expect(201);
    expect(cognito.enableUser).toHaveBeenCalledWith(target.email);
  });

  it('rejects an invite without a role and sends nothing (AC11)', async () => {
    const { agent } = await signedIn('hr_admin');
    cognito.createUser.mockClear();
    notifier.notify.mockClear();
    await agent.post('/admin/users/invite').send({ email: 'n@x.com', displayName: 'N' }).expect(400);
    expect(cognito.createUser).not.toHaveBeenCalled();
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it('ends the deactivated user session at once (AC9)', async () => {
    const { agent: admin } = await signedIn('hr_admin');
    const { agent: member, user } = await signedIn('employee');
    await member.get('/auth/session').expect(200);
    await admin.post(`/admin/users/${user.id}/deactivate`).expect(201);
    await member.get('/auth/session').expect(401);
    expect(cognito.signOut).toHaveBeenCalledWith('refresh-token');
    expect(cognito.disableUser).toHaveBeenCalledWith(user.email);
  });
});
