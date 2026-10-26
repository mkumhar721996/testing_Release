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
import { LeaveEntry } from '../src/leave/leave-entry.entity';

const PASSWORD = 'test-password';

process.env.SESSION_ENCRYPTION_KEY ??= 'test-encryption-key';

describe('Role-based access (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let n = 0;

  const makeUser = (role?: Role) =>
    ds.getRepository(User).save({
      email: `access${Date.now()}-${n++}@example.com`,
      cognitoSub: 'sub',
      status: 'active',
      failedSignInCount: 0,
      lockStartedAt: null,
      ...(role ? { role } : {}),
    });

  const makePerson = async (
    role: Role,
    managerId: string | null = null,
    displayName = `Person ${n}`,
  ) => {
    const user = await makeUser(role);
    const employee = await ds
      .getRepository(Employee)
      .save({ userId: user.id, displayName, managerId });
    return { user, employee };
  };

  const signedIn = async (email: string) => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/sign-in').send({ email, password: PASSWORD });
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

  it('defaults a user created without a role to employee', async () => {
    const user = await makeUser();
    expect(user.role).toBe('employee');
    const found = await ds.getRepository(User).findOneByOrFail({ id: user.id });
    expect(found.role).toBe('employee');
  });

  it('returns the role from the session probe', async () => {
    const { user } = await makePerson('manager');
    const agent = await signedIn(user.email);
    const res = await agent.get('/auth/session').expect(200);
    expect(res.body.user.role).toBe('manager');
  });

  it('refuses a user with no employee row instead of throwing', async () => {
    const user = await makeUser();
    const agent = await signedIn(user.email);
    await agent.get('/employees/me').expect(403);
    const leave = await agent.get('/leave/me').expect(200);
    expect(leave.body.entries).toEqual([]);
  });

  it('shows an employee their own profile (AC1)', async () => {
    const { user, employee } = await makePerson('employee');
    const agent = await signedIn(user.email);
    const res = await agent.get('/employees/me').expect(200);
    expect(res.body.id).toBe(employee.id);
  });

  it('refuses an employee another record and leaks nothing (AC2, AC9)', async () => {
    const { user } = await makePerson('employee');
    const other = await makePerson('employee', null, 'Secret Name');
    const agent = await signedIn(user.email);
    const res = await agent.get(`/employees/${other.employee.id}`).expect(403);
    expect(res.body.displayName).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('Secret Name');
  });

  it('refuses an unknown id the same way, not 404 (AC9)', async () => {
    const { user } = await makePerson('employee');
    const agent = await signedIn(user.email);
    await agent
      .get('/employees/00000000-0000-4000-8000-000000000000')
      .expect(403);
    await agent.get('/employees/not-a-uuid').expect(403);
  });

  it('shows a manager direct reports only (AC3, AC4)', async () => {
    const manager = await makePerson('manager');
    const report = await makePerson('employee', manager.employee.id);
    const indirect = await makePerson('employee', report.employee.id);
    const stranger = await makePerson('employee');
    const agent = await signedIn(manager.user.email);
    await agent.get(`/employees/${report.employee.id}`).expect(200);
    await agent.get(`/employees/${indirect.employee.id}`).expect(403);
    await agent.get(`/employees/${stranger.employee.id}`).expect(403);
  });

  it('shows an HR admin any record (AC5)', async () => {
    const admin = await makePerson('hr_admin');
    const other = await makePerson('employee');
    const agent = await signedIn(admin.user.email);
    await agent.get(`/employees/${other.employee.id}`).expect(200);
  });

  it('refuses the executive any change and leaves the row alone (AC6)', async () => {
    const exec = await makePerson('read_only_executive', null, 'Before');
    const agent = await signedIn(exec.user.email);
    await agent
      .patch(`/employees/${exec.employee.id}`)
      .send({ displayName: 'x' })
      .expect(403);
    const stored = await ds
      .getRepository(Employee)
      .findOneByOrFail({ id: exec.employee.id });
    expect(stored.displayName).toBe('Before');
  });

  it('lets an HR admin change a record', async () => {
    const admin = await makePerson('hr_admin');
    const other = await makePerson('employee');
    const agent = await signedIn(admin.user.email);
    await agent
      .patch(`/employees/${other.employee.id}`)
      .send({ displayName: 'Renamed' })
      .expect(200);
    const stored = await ds
      .getRepository(Employee)
      .findOneByOrFail({ id: other.employee.id });
    expect(stored.displayName).toBe('Renamed');
  });

  it.each<Role>(['manager', 'hr_admin', 'read_only_executive'])(
    'shows %s their own profile and leave (AC7, AC8)',
    async (role) => {
      const { user, employee } = await makePerson(role);
      await ds.getRepository(LeaveEntry).save({
        employeeId: employee.id,
        startDate: '2026-02-02',
        endDate: '2026-02-03',
        kind: 'annual',
      });
      const agent = await signedIn(user.email);
      const profile = await agent.get('/employees/me').expect(200);
      expect(profile.body.id).toBe(employee.id);
      const leave = await agent.get('/leave/me').expect(200);
      expect(leave.body.entries).toHaveLength(1);
    },
  );

  it('shows dashboards to the executive and refuses an employee (AC12)', async () => {
    const exec = await makePerson('read_only_executive');
    const emp = await makePerson('employee');
    await (await signedIn(exec.user.email)).get('/dashboards').expect(200);
    await (await signedIn(emp.user.email)).get('/dashboards').expect(403);
  });

  it('requires a session', async () => {
    await request(app.getHttpServer()).get('/employees/me').expect(401);
  });
});
