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

const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

describe('Manager dashboard (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let n = 0;
  const unique = () => `${Date.now()}-${n++}`;

  const makePerson = async (
    role: Role,
    managerId: string | null = null,
    displayName = `Person ${unique()}`,
  ) => {
    const user = await ds.getRepository(User).save({
      email: `team${unique()}@example.com`,
      cognitoSub: 'sub',
      status: 'active',
      failedSignInCount: 0,
      lockStartedAt: null,
      role,
    });
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

  it('returns only the manager’s own reports', async () => {
    const boss = await makePerson('manager');
    const mine = await makePerson('employee', boss.employee.id, 'Mine Ana');
    const other = await makePerson('employee', null, 'Other Stranger');
    const leave = ds.getRepository(LeaveEntry);
    await leave.save({
      employeeId: mine.employee.id,
      startDate: day(2),
      endDate: day(3),
      kind: 'annual',
    });
    await leave.save({
      employeeId: other.employee.id,
      startDate: day(2),
      endDate: day(3),
      kind: 'annual',
    });
    await leave.save({
      employeeId: mine.employee.id,
      startDate: day(10),
      endDate: day(10),
      kind: 'sick',
      status: 'pending',
    });
    const agent = await signedIn(boss.user.email);
    const res = await agent.get('/dashboards/manager').expect(200);
    expect(res.body.offDays.map((d: { date: string }) => d.date)).toEqual([
      day(2),
      day(3),
    ]);
    expect(res.body.pending).toHaveLength(1);
    expect(JSON.stringify(res.body)).not.toContain('Other Stranger');
  });

  it('drops a report once HR moves them to no manager (AC7)', async () => {
    const admin = await makePerson('hr_admin');
    const boss = await makePerson('manager');
    const mine = await makePerson('employee', boss.employee.id);
    await ds.getRepository(LeaveEntry).save({
      employeeId: mine.employee.id,
      startDate: day(2),
      endDate: day(3),
      kind: 'annual',
    });
    await ds
      .getRepository(Employee)
      .update({ id: mine.employee.id }, { managerId: null });
    void admin;
    const agent = await signedIn(boss.user.email);
    const res = await agent.get('/dashboards/manager').expect(200);
    expect(res.body.offDays).toEqual([]);
  });

  it('refuses everyone but a manager, and routes no write', async () => {
    const employee = await makePerson('employee');
    const exec = await makePerson('read_only_executive');
    const boss = await makePerson('manager');
    await (
      await signedIn(employee.user.email)
    )
      .get('/dashboards/manager')
      .expect(403);
    await (
      await signedIn(exec.user.email)
    )
      .get('/dashboards/manager')
      .expect(403);
    await request(app.getHttpServer()).get('/dashboards/manager').expect(401);
    await (
      await signedIn(boss.user.email)
    )
      .post('/dashboards/manager')
      .expect(404);
  });

  it('defaults a saved leave entry to approved', async () => {
    const p = await makePerson('employee');
    const saved = await ds.getRepository(LeaveEntry).save({
      employeeId: p.employee.id,
      startDate: day(1),
      endDate: day(1),
      kind: 'annual',
    });
    const reloaded = await ds
      .getRepository(LeaveEntry)
      .findOneByOrFail({ id: saved.id });
    expect(reloaded.status).toBe('approved');
    const res = await (
      await signedIn(p.user.email)
    )
      .get('/leave/me')
      .expect(200);
    expect(res.body.entries[0].status).toBe('approved');
  });
});
