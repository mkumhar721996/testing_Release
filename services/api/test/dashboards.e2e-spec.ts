import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { COGNITO_AUTH } from '../src/auth/cognito-auth.port';
import { User } from '../src/auth/entities/user.entity';
import { Role } from '../src/auth/role';
import { fakeCognito } from '../src/auth/testing/fakes';
import { Employee } from '../src/employees/employee.entity';

const PASSWORD = 'test-password';

process.env.SESSION_ENCRYPTION_KEY ??= 'test-encryption-key';

describe('Executive dashboard (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let n = 0;

  const makePerson = async (role: Role, displayName = `Person ${n}`) => {
    const user = await ds.getRepository(User).save({
      email: `dash${Date.now()}-${n++}@example.com`,
      cognitoSub: 'sub',
      status: 'active',
      failedSignInCount: 0,
      lockStartedAt: null,
      role,
    });
    await ds.getRepository(Employee).save({
      userId: user.id,
      displayName,
      payAnnualMinor: 9900000,
      payCurrency: 'GBP',
    });
    return user;
  };

  const signedIn = async (role: Role, displayName?: string) => {
    const user = await makePerson(role, displayName);
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/sign-in')
      .send({ email: user.email, password: PASSWORD });
    return agent;
  };

  beforeAll(async () => {
    const cognito = fakeCognito();
    cognito.signIn.mockResolvedValue({ refreshToken: 'r', sub: 'sub' });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(COGNITO_AUTH)
      .useValue(cognito)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    ds = app.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('gives the executive counts only (AC1, AC2, AC3, AC5)', async () => {
    await makePerson('employee', 'Secret Name');
    const exec = await signedIn('read_only_executive');
    const res = await exec.get('/dashboards/executive').expect(200);
    expect(typeof res.body.headcount).toBe('number');
    expect(typeof res.body.leaveDaysTaken).toBe('number');
    expect(Object.keys(res.body).sort()).toEqual([
      'hasData',
      'headcount',
      'leaveDaysTaken',
      'leaveYear',
    ]);
    expect(JSON.stringify(res.body)).not.toContain('Secret Name');
    expect(JSON.stringify(res.body)).not.toMatch(/pay|displayName/i);
  });

  it('refuses the executive any change (AC6)', async () => {
    const exec = await signedIn('read_only_executive');
    await exec.post('/dashboards/executive').expect(403);
  });

  it('refuses every other role (AC7)', async () => {
    for (const role of ['employee', 'manager', 'hr_admin'] as Role[]) {
      const agent = await signedIn(role);
      await agent.get('/dashboards/executive').expect(403);
    }
  });

  it('requires a session', async () => {
    await request(app.getHttpServer()).get('/dashboards/executive').expect(401);
  });
});
