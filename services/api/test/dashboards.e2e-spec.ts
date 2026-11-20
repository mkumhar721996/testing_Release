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

interface Summary {
  headcount: number;
  leavers12m: number;
  leaveDays: number;
  headcountByDepartment: { department: string; count: number }[];
  leaveByType: { kind: string; days: number }[];
}

describe('HR admin dashboard (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let n = 0;
  const unique = () => `${Date.now()}-${n++}`;
  const day = (offsetDays: number) =>
    new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

  const makePerson = async (role: Role, over: Partial<Employee> = {}) => {
    const user = await ds.getRepository(User).save({
      email: `dash${unique()}@example.com`,
      cognitoSub: 'sub',
      status: 'active',
      failedSignInCount: 0,
      lockStartedAt: null,
      role,
    });
    const employee = await ds
      .getRepository(Employee)
      .save({ userId: user.id, displayName: `Person ${unique()}`, ...over });
    return { user, employee };
  };

  const signedIn = async (email: string) => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/sign-in').send({ email, password: PASSWORD });
    return agent;
  };

  // The database is shared with other e2e files, so assert on deltas.
  const summary = async (agent: request.Agent) =>
    (await agent.get('/dashboards/hr-admin').expect(200)).body as Summary;

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

  it('counts current employees across every department (AC1, AC2)', async () => {
    const hr = await makePerson('hr_admin', { department: 'Finance' });
    const agent = await signedIn(hr.user.email);
    const before = await summary(agent);
    const repo = ds.getRepository(Employee);
    await repo.save([
      { displayName: 'A', department: 'Finance' },
      { displayName: 'B', department: 'People' },
      { displayName: 'C', department: null },
      { displayName: 'D', department: 'Finance', terminationDate: day(-730) },
    ]);
    const after = await summary(agent);
    expect(after.headcount - before.headcount).toBe(3);
    expect(after.headcount).toBe(
      after.headcountByDepartment.reduce((sum, d) => sum + d.count, 0),
    );
    const dept = (s: Summary, name: string) =>
      s.headcountByDepartment.find((d) => d.department === name)?.count ?? 0;
    expect(dept(after, 'Finance') - dept(before, 'Finance')).toBe(1);
    expect(dept(after, 'People') - dept(before, 'People')).toBe(1);
    expect(dept(after, 'Unassigned') - dept(before, 'Unassigned')).toBe(1);
  });

  it('counts leavers within 12 months only (AC6, AC7)', async () => {
    const hr = await makePerson('hr_admin');
    const agent = await signedIn(hr.user.email);
    const before = await summary(agent);
    await ds.getRepository(Employee).save([
      { displayName: 'Recent', terminationDate: day(-30) },
      { displayName: 'Old', terminationDate: day(-400) },
    ]);
    const after = await summary(agent);
    expect(after.leavers12m - before.leavers12m).toBe(1);
    expect(after.headcount).toBe(before.headcount);
  });

  it('sums leave across employees by kind (AC3, AC8)', async () => {
    const hr = await makePerson('hr_admin');
    const other = await makePerson('employee');
    const agent = await signedIn(hr.user.email);
    const before = await summary(agent);
    await ds.getRepository(LeaveEntry).save([
      {
        employeeId: hr.employee.id,
        startDate: '2026-02-02',
        endDate: '2026-02-04',
        kind: 'annual',
      },
      {
        employeeId: other.employee.id,
        startDate: '2026-03-02',
        endDate: '2026-03-03',
        kind: 'annual',
      },
      {
        employeeId: other.employee.id,
        startDate: '2026-03-09',
        endDate: '2026-03-10',
        kind: 'sick',
      },
    ]);
    const after = await summary(agent);
    const kind = (s: Summary, k: string) =>
      s.leaveByType.find((t) => t.kind === k)?.days ?? 0;
    expect(after.leaveDays - before.leaveDays).toBe(7);
    expect(kind(after, 'annual') - kind(before, 'annual')).toBe(5);
    expect(kind(after, 'sick') - kind(before, 'sick')).toBe(2);
  });

  it('shows no pay or salary (AC5)', async () => {
    const hr = await makePerson('hr_admin', {
      payAnnualMinor: 5200000,
      payCurrency: 'GBP',
    });
    const agent = await signedIn(hr.user.email);
    const res = await agent.get('/dashboards/hr-admin').expect(200);
    expect(JSON.stringify(res.body)).not.toMatch(/pay|salary/i);
  });

  it.each<Role>(['employee', 'manager', 'read_only_executive'])(
    'refuses %s with no figures (AC4)',
    async (role) => {
      const person = await makePerson(role);
      const agent = await signedIn(person.user.email);
      const res = await agent.get('/dashboards/hr-admin').expect(403);
      expect(res.body.headcount).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/leave|headcount/i);
    },
  );

  it('requires a session (AC4)', async () => {
    await request(app.getHttpServer()).get('/dashboards/hr-admin').expect(401);
  });

  it('still counts an employee saved without a termination date', async () => {
    const hr = await makePerson('hr_admin');
    const stored = await ds
      .getRepository(Employee)
      .findOneByOrFail({ id: hr.employee.id });
    expect(stored.terminationDate).toBeNull();
    const agent = await signedIn(hr.user.email);
    expect((await summary(agent)).headcount).toBeGreaterThanOrEqual(1);
  });
});
