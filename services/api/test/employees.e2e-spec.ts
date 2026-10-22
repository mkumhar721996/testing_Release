import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { COGNITO_AUTH } from '../src/auth/cognito-auth.port';
import { User, type UserRole } from '../src/auth/entities/user.entity';
import { fakeCognito } from '../src/auth/testing/fakes';
import { Employee } from '../src/employees/entities/employee.entity';

process.env.SESSION_ENCRYPTION_KEY ??= 'test-encryption-key';

describe('Employees (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let n = 0;

  const signedIn = async (role: UserRole) => {
    const email = `user${Date.now()}-${n++}@example.com`;
    await ds.getRepository(User).save({
      email,
      cognitoSub: 'sub',
      status: 'active',
      role,
    });
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/sign-in')
      .send({ email, password: 'test-password' })
      .expect(200);
    return agent;
  };

  const seed = () =>
    ds.getRepository(Employee).save([
      { name: 'Ava Chen', email: 'ava.chen@example.com', status: 'active' },
      {
        name: 'Priya Shah',
        email: 'priya.shah@example.com',
        status: 'on_leave',
      },
      { name: 'Maria Lopez', email: 'm.lopez@example.com', status: 'inactive' },
      { name: 'Tom Reed', email: 'tom.reed@example.com', status: 'active' },
    ]);

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

  beforeEach(async () => {
    await ds.getRepository(Employee).clear();
    await seed();
  });

  afterAll(async () => {
    await ds.getRepository(Employee).clear();
    await app?.close();
  });

  it('requires a session', async () => {
    await request(app.getHttpServer()).get('/employees').expect(401);
  });

  it('returns the session role', async () => {
    const agent = await signedIn('hr_admin');
    const res = await agent.get('/auth/session').expect(200);
    expect(res.body.user.role).toBe('hr_admin');
  });

  it('lists every employee for an HR admin (AC1)', async () => {
    const agent = await signedIn('hr_admin');
    const res = await agent.get('/employees').expect(200);
    expect(res.body.employees.map((e: Employee) => e.status).sort()).toEqual([
      'active',
      'active',
      'inactive',
      'on_leave',
    ]);
  });

  it('lists every employee for a manager (AC2)', async () => {
    const agent = await signedIn('manager');
    const res = await agent.get('/employees').expect(200);
    expect(res.body.employees).toHaveLength(4);
  });

  it('searches by name, case-insensitively (AC3, AC5)', async () => {
    const agent = await signedIn('manager');
    for (const q of ['Maria Lopez', 'MARIA LOPEZ']) {
      const res = await agent.get('/employees').query({ q }).expect(200);
      expect(res.body.employees.map((e: Employee) => e.name)).toEqual([
        'Maria Lopez',
      ]);
    }
  });

  it('searches by work email, case-insensitively (AC4, AC6)', async () => {
    const agent = await signedIn('manager');
    for (const q of ['m.lopez@example.com', 'M.LOPEZ@EXAMPLE.COM']) {
      const res = await agent.get('/employees').query({ q }).expect(200);
      expect(res.body.employees.map((e: Employee) => e.email)).toEqual([
        'm.lopez@example.com',
      ]);
    }
  });

  it('treats % and _ in the search literally', async () => {
    const agent = await signedIn('manager');
    for (const q of ['m_lopez', '%']) {
      const res = await agent.get('/employees').query({ q }).expect(200);
      expect(res.body.employees).toEqual([]);
    }
  });

  it('combines search with the status tab (AC7)', async () => {
    const agent = await signedIn('manager');
    const res = await agent
      .get('/employees')
      .query({ q: 'Maria Lopez', status: 'active' })
      .expect(200);
    expect(res.body.employees).toEqual([]);
    expect(res.body.total).toBe(4);
    expect(res.body.counts).toEqual({
      all: 1,
      active: 0,
      on_leave: 0,
      inactive: 1,
    });
  });

  it('filters by each status (AC8) and rejects unknown ones', async () => {
    const agent = await signedIn('manager');
    for (const status of ['active', 'on_leave', 'inactive']) {
      const res = await agent.get('/employees').query({ status }).expect(200);
      expect(res.body.employees.length).toBeGreaterThan(0);
      expect(
        res.body.employees.every((e: Employee) => e.status === status),
      ).toBe(true);
    }
    await agent.get('/employees').query({ status: 'bogus' }).expect(400);
  });

  it('reports total 0 when the company has no employees (AC9-11)', async () => {
    await ds.getRepository(Employee).clear();
    const agent = await signedIn('hr_admin');
    const res = await agent.get('/employees').expect(200);
    expect(res.body).toEqual({
      employees: [],
      counts: { all: 0, active: 0, on_leave: 0, inactive: 0 },
      total: 0,
    });
  });
});
