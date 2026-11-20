import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { AuditEntry } from '../src/audit/audit-entry.entity';
import { COGNITO_AUTH } from '../src/auth/cognito-auth.port';
import { User } from '../src/auth/entities/user.entity';
import { Role } from '../src/auth/role';
import { fakeCognito } from '../src/auth/testing/fakes';
import { Employee } from '../src/employees/employee.entity';
import { LeaveBalance } from '../src/leave/leave-balance.entity';
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
      .save({ userId: user.id, displayName: `Leave ${run}-${n}` });
    return { user, employee };
  };

  const signedIn = async (role: Role) => {
    const { user, employee } = await makePerson(role);
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/sign-in')
      .send({ email: user.email, password: PASSWORD });
    return { agent, user, employee };
  };

  const typeName = (base: string) => `${base} ${run}-${n++}`;
  const makeType = (name: string, exempt = false) =>
    ds.getRepository(LeaveType).save({ name, exempt });

  const auditCount = (entityId: string) =>
    ds.getRepository(AuditEntry).countBy({ entityId });

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

  it('creates a leave type that appears in the list, with an audit row (AC1)', async () => {
    const { agent } = await signedIn('hr_admin');
    const name = typeName('Annual leave');
    const created = await agent.post('/leave-types').send({ name }).expect(201);
    const list = await agent.get('/leave-types').expect(200);
    expect(list.body.find((t: { name: string }) => t.name === name)).toEqual({
      id: created.body.id,
      name,
      exempt: false,
      balanceCount: 0,
    });
    expect(await auditCount(created.body.id)).toBe(1);
  });

  it('refuses a blank and a duplicate name and writes no audit row', async () => {
    const { agent } = await signedIn('hr_admin');
    const name = typeName('Dup');
    await makeType(name);
    const before = await ds.getRepository(AuditEntry).count();
    await agent.post('/leave-types').send({ name: '  ' }).expect(400);
    const dup = await agent
      .post('/leave-types')
      .send({ name: name.toUpperCase() })
      .expect(409);
    expect(dup.body.code).toBe('leave_type_name_taken');
    expect(await ds.getRepository(AuditEntry).count()).toBe(before);
  });

  it('sets, adjusts and keeps other types independent (AC2-AC4, AC11)', async () => {
    const { agent } = await signedIn('hr_admin');
    const { employee } = await makePerson('employee');
    const annual = await makeType(typeName('Annual'));
    const sick = await makeType(typeName('Sick'));
    const put = (typeId: string, days: unknown) =>
      agent.put(`/employees/${employee.id}/leave-balances/${typeId}`).send({ days });
    const rows = async () =>
      (await agent.get(`/employees/${employee.id}/leave-balances`).expect(200))
        .body as Array<{ leaveTypeId: string; days: number | null }>;
    const days = async (id: string) =>
      (await rows()).find((r) => r.leaveTypeId === id)!.days;

    expect(await days(sick.id)).toBeNull();
    await put(annual.id, 10).expect(200);
    expect(await days(annual.id)).toBe(10);
    await put(annual.id, 7).expect(200);
    expect(await days(annual.id)).toBe(7);
    expect(
      await ds
        .getRepository(LeaveBalance)
        .countBy({ employeeId: employee.id, leaveTypeId: annual.id }),
    ).toBe(1);

    await put(annual.id, 10).expect(200);
    await put(sick.id, 5).expect(200);
    await put(sick.id, 3).expect(200);
    expect(await days(annual.id)).toBe(10);
    expect(await days(sick.id)).toBe(3);
    await put(sick.id, 0).expect(200);
    expect(await days(sick.id)).toBe(0);

    const stored = await ds
      .getRepository(LeaveBalance)
      .findOneByOrFail({ employeeId: employee.id, leaveTypeId: annual.id });
    expect(await auditCount(stored.id)).toBe(3);
  });

  it('rejects invalid days and unknown ids', async () => {
    const { agent } = await signedIn('hr_admin');
    const { employee } = await makePerson('employee');
    const annual = await makeType(typeName('Annual'));
    const url = `/employees/${employee.id}/leave-balances/${annual.id}`;
    for (const days of [-1, 2.5, '3']) {
      const res = await agent.put(url).send({ days }).expect(400);
      expect(res.body.code).toBe('balance_invalid');
    }
    const ghost = '00000000-0000-4000-8000-000000000000';
    await agent
      .put(`/employees/${ghost}/leave-balances/${annual.id}`)
      .send({ days: 1 })
      .expect(404);
    await agent
      .put(`/employees/${employee.id}/leave-balances/${ghost}`)
      .send({ days: 1 })
      .expect(404);
    expect(
      await ds.getRepository(LeaveBalance).countBy({ employeeId: employee.id }),
    ).toBe(0);
  });

  it('turns exempt on and off (AC6, AC7)', async () => {
    const { agent } = await signedIn('hr_admin');
    const name = typeName('Unpaid');
    const unpaid = await makeType(name);
    const exempt = async () =>
      (await agent.get('/leave-types').expect(200)).body.find(
        (t: { name: string }) => t.name === name,
      ).exempt;
    await agent.patch(`/leave-types/${unpaid.id}`).send({ exempt: true }).expect(200);
    expect(await exempt()).toBe(true);
    await agent.patch(`/leave-types/${unpaid.id}`).send({ exempt: false }).expect(200);
    expect(await exempt()).toBe(false);
    expect(await auditCount(unpaid.id)).toBe(2);
  });

  it('refuses to delete a type with a balance, deletes an unused one', async () => {
    const { agent } = await signedIn('hr_admin');
    const { employee } = await makePerson('employee');
    const used = await makeType(typeName('Used'));
    const free = await makeType(typeName('Free'));
    await agent
      .put(`/employees/${employee.id}/leave-balances/${used.id}`)
      .send({ days: 1 })
      .expect(200);
    const res = await agent.delete(`/leave-types/${used.id}`).expect(409);
    expect(res.body.code).toBe('leave_type_in_use');
    expect(await ds.getRepository(LeaveType).findOneBy({ id: used.id })).not.toBeNull();
    await agent.delete(`/leave-types/${free.id}`).expect(204);
    expect(await ds.getRepository(LeaveType).findOneBy({ id: free.id })).toBeNull();
    expect(await auditCount(free.id)).toBe(1);
  });

  it.each(['employee', 'manager', 'read_only_executive'] as Role[])(
    'refuses changes from %s (AC5)',
    async (role) => {
      const { agent } = await signedIn(role);
      const { employee } = await makePerson('employee');
      const annual = await makeType(typeName('Annual'));
      const name = typeName('Study');
      await agent.post('/leave-types').send({ name }).expect(403);
      await agent
        .patch(`/leave-types/${annual.id}`)
        .send({ exempt: true })
        .expect(403);
      await agent.delete(`/leave-types/${annual.id}`).expect(403);
      await agent
        .put(`/employees/${employee.id}/leave-balances/${annual.id}`)
        .send({ days: 99 })
        .expect(403);
      await agent.get(`/employees/${employee.id}/leave-balances`).expect(403);
      await agent.get('/leave-types').expect(200);
      expect(await ds.getRepository(LeaveType).countBy({ name })).toBe(0);
      expect(
        (await ds.getRepository(LeaveType).findOneByOrFail({ id: annual.id }))
          .exempt,
      ).toBe(false);
      expect(
        await ds.getRepository(LeaveBalance).countBy({ employeeId: employee.id }),
      ).toBe(0);
    },
  );

  it('requires a session', async () => {
    await request(app.getHttpServer()).get('/leave-types').expect(401);
    await request(app.getHttpServer())
      .post('/leave-types')
      .send({ name: 'x' })
      .expect(401);
  });
});
