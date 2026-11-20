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
import { LeaveBalance } from '../src/leave/leave-balance.entity';
import { LeaveEntry } from '../src/leave/leave-entry.entity';
import { LeaveType } from '../src/leave/leave-type.entity';

const PASSWORD = 'test-password';

process.env.SESSION_ENCRYPTION_KEY ??= 'test-encryption-key';

describe('Leave types and balances (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let n = 0;
  const run = Date.now();

  const makePerson = async (role: Role) => {
    const user = await ds.getRepository(User).save({
      email: `leave${run}-${n++}@example.com`,
      cognitoSub: 'sub',
      status: 'active',
      failedSignInCount: 0,
      lockStartedAt: null,
      role,
    });
    const employee = await ds
      .getRepository(Employee)
      .save({ userId: user.id, displayName: `Leave ${n}`, managerId: null });
    return { user, employee };
  };

  const signedIn = async (role: Role) => {
    const { user, employee } = await makePerson(role);
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/sign-in')
      .send({ email: user.email, password: PASSWORD });
    return { agent, employee };
  };

  const makeType = (name: string, exempt = false) =>
    ds.getRepository(LeaveType).save({ name: `${name} ${run}-${n++}`, exempt });

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

  const typesOf = async (agent: request.Agent) =>
    (await agent.get('/leave-types').expect(200)).body as Array<{
      id: string;
      name: string;
      exempt: boolean;
    }>;

  it('creates a leave type that then appears in the list (AC1)', async () => {
    const { agent } = await signedIn('hr_admin');
    const name = `Study leave ${run}`;
    await agent.post('/leave-types').send({ name }).expect(201);
    expect((await typesOf(agent)).map((t) => t.name)).toContain(name);
    await agent.post('/leave-types').send({ name: name.toUpperCase() }).expect(409);
    await agent.post('/leave-types').send({ name: '  ' }).expect(400);
  });

  it('sets, adjusts and isolates balances (AC2, AC3, AC4, AC11)', async () => {
    const { agent } = await signedIn('hr_admin');
    const { employee } = await makePerson('employee');
    const annual = await makeType('Annual');
    const sick = await makeType('Sick');
    const put = (type: LeaveType, days: unknown) =>
      agent.put(`/employees/${employee.id}/leave-balances/${type.id}`).send({ days });
    const get = async () =>
      (await agent.get(`/employees/${employee.id}/leave-balances`).expect(200))
        .body as Array<{ leaveTypeId: string; days: number | null }>;
    const daysOf = async (t: LeaveType) =>
      (await get()).find((r) => r.leaveTypeId === t.id)?.days;

    expect(await daysOf(sick)).toBeNull();
    await put(annual, 10).expect(200);
    expect(await daysOf(annual)).toBe(10);
    await put(sick, 5).expect(200);
    await put(annual, 7).expect(200);
    expect(await daysOf(annual)).toBe(7);
    expect(
      await ds
        .getRepository(LeaveBalance)
        .countBy({ employeeId: employee.id, leaveTypeId: annual.id }),
    ).toBe(1);
    await put(annual, 10).expect(200);
    await put(sick, 3).expect(200);
    expect(await daysOf(annual)).toBe(10);
    expect(await daysOf(sick)).toBe(3);
    await put(sick, 0).expect(200);
    expect(await daysOf(sick)).toBe(0);

    for (const bad of [-1, 2.5, '3']) await put(annual, bad).expect(400);
    await agent
      .put(`/employees/${employee.id}/leave-balances/${'0'.repeat(8)}-0000-4000-8000-000000000000`)
      .send({ days: 1 })
      .expect(404);
  });

  it.each(['employee', 'manager', 'read_only_executive'] as Role[])(
    'refuses changes from a %s (AC5)',
    async (role) => {
      const { agent, employee } = await signedIn(role);
      const annual = await makeType('Refused');
      const name = `Nope ${run}-${role}`;
      await agent.post('/leave-types').send({ name }).expect(403);
      await agent.patch(`/leave-types/${annual.id}`).send({ exempt: true }).expect(403);
      await agent.delete(`/leave-types/${annual.id}`).expect(403);
      await agent
        .put(`/employees/${employee.id}/leave-balances/${annual.id}`)
        .send({ days: 99 })
        .expect(403);
      await agent.get('/employees').expect(403);
      await agent.get('/leave-types').expect(200);
      expect(await ds.getRepository(LeaveType).countBy({ name })).toBe(0);
      expect(await ds.getRepository(LeaveType).countBy({ id: annual.id, exempt: false })).toBe(1);
      expect(await ds.getRepository(LeaveBalance).countBy({ employeeId: employee.id })).toBe(0);
    },
  );

  it('requires a session', async () => {
    await request(app.getHttpServer()).post('/leave-types').send({ name: 'x' }).expect(401);
  });

  it('toggles exempt and renames (AC6, AC7, AC8)', async () => {
    const { agent } = await signedIn('hr_admin');
    const t = await makeType('Unpaid');
    const exemptOf = async () => (await typesOf(agent)).find((x) => x.id === t.id)?.exempt;
    await agent.patch(`/leave-types/${t.id}`).send({ exempt: true }).expect(200);
    expect(await exemptOf()).toBe(true);
    await agent.patch(`/leave-types/${t.id}`).send({ exempt: false }).expect(200);
    expect(await exemptOf()).toBe(false);
    const renamed = `Renamed ${run}-${n++}`;
    await agent.patch(`/leave-types/${t.id}`).send({ name: renamed }).expect(200);
    expect((await typesOf(agent)).map((x) => x.name)).toContain(renamed);
    const other = await makeType('Other');
    await agent
      .patch(`/leave-types/${t.id}`)
      .send({ name: other.name.toLowerCase() })
      .expect(409);
  });

  it('deletes an unused type and refuses a used one (AC9, AC10)', async () => {
    const { agent } = await signedIn('hr_admin');
    const { employee } = await makePerson('employee');
    const free = await makeType('Free');
    await agent.delete(`/leave-types/${free.id}`).expect(204);
    expect(await ds.getRepository(LeaveType).findOneBy({ id: free.id })).toBeNull();

    const used = await makeType('Used');
    await agent
      .put(`/employees/${employee.id}/leave-balances/${used.id}`)
      .send({ days: 2 })
      .expect(200);
    await agent.delete(`/leave-types/${used.id}`).expect(409);
    expect(await ds.getRepository(LeaveType).findOneBy({ id: used.id })).not.toBeNull();

    const booked = await makeType('Booked');
    await ds.getRepository(LeaveEntry).save({
      employeeId: employee.id,
      startDate: '2030-01-01',
      endDate: '2030-01-02',
      kind: booked.id,
    });
    await agent.delete(`/leave-types/${booked.id}`).expect(409);
  });

  it('lists employees for HR only', async () => {
    const { agent } = await signedIn('hr_admin');
    const { body } = await agent.get('/employees').expect(200);
    expect(body[0]).toEqual({ id: expect.any(String), displayName: expect.any(String) });
  });
});
