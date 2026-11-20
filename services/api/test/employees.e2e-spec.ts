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

const PASSWORD = 'test-password';

process.env.SESSION_ENCRYPTION_KEY ??= 'test-encryption-key';

describe('Employee records (e2e)', () => {
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
      email: `records${unique()}@example.com`,
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

  const validBody = (over: Record<string, unknown> = {}) => ({
    displayName: 'Priya Shah',
    jobTitle: 'Recruiter',
    department: 'People',
    managerId: undefined as string | undefined,
    payAnnual: 52000,
    contactEmail: `priya.shah.${unique()}@acme.example`,
    phone: '+44 20 7946 0188',
    ...over,
  });

  const createEmployee = async (
    agent: request.Agent,
    managerId: string,
    over: Record<string, unknown> = {},
  ) =>
    (
      await agent
        .post('/employees')
        .send(validBody({ managerId, ...over }))
        .expect(201)
    ).body as Employee;

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

  it('finds an employee by name for an HR admin (AC1)', async () => {
    const admin = await makePerson('hr_admin');
    await makePerson('employee', null, 'Priya Raman');
    const agent = await signedIn(admin.user.email);
    const res = await agent.get('/employees').query({ q: 'priya' }).expect(200);
    expect(
      res.body.map((e: { displayName: string }) => e.displayName),
    ).toContain('Priya Raman');
  });

  it('opens the full record for an HR admin (AC2)', async () => {
    const admin = await makePerson('hr_admin');
    const boss = await makePerson('manager');
    const agent = await signedIn(admin.user.email);
    const created = await createEmployee(agent, boss.employee.id);
    const res = await agent.get(`/employees/${created.id}`).expect(200);
    expect(res.body).toMatchObject({
      jobTitle: 'Recruiter',
      department: 'People',
      payAnnualMinor: 5200000,
      contactEmail: created.contactEmail,
    });
  });

  it('creates an employee with a manager (AC3)', async () => {
    const admin = await makePerson('hr_admin');
    const boss = await makePerson('manager');
    const agent = await signedIn(admin.user.email);
    const body = validBody({
      managerId: boss.employee.id,
      contactEmail: `New.Hire${unique()}@Acme.Example`,
    });
    const res = await agent.post('/employees').send(body).expect(201);
    const stored = await ds
      .getRepository(Employee)
      .findOneByOrFail({ id: res.body.id });
    expect(stored.managerId).toBe(boss.employee.id);
    expect(stored.contactEmail).toBe(body.contactEmail.toLowerCase());
    expect(
      await ds
        .getRepository(AuditEntry)
        .count({ where: { entityId: stored.id } }),
    ).toBe(1);
  });

  it('refuses a create with no manager (AC4)', async () => {
    const admin = await makePerson('hr_admin');
    const agent = await signedIn(admin.user.email);
    const body = validBody();
    const res = await agent.post('/employees').send(body).expect(400);
    expect(res.body.code).toBe('manager_required');
    expect(
      await ds
        .getRepository(Employee)
        .count({ where: { contactEmail: body.contactEmail } }),
    ).toBe(0);
  });

  it.each([
    ['displayName', 'Renamed Person'],
    ['jobTitle', 'Principal Analyst'],
    ['department', 'Finance'],
    ['payAnnual', 61000],
    ['contactEmail', `changed${unique()}@acme.example`],
    ['phone', '+44 20 0000 0000'],
  ])('changes %s and shows it on the record (AC5)', async (field, value) => {
    const admin = await makePerson('hr_admin');
    const boss = await makePerson('manager');
    const agent = await signedIn(admin.user.email);
    const created = await createEmployee(agent, boss.employee.id);
    await agent
      .patch(`/employees/${created.id}`)
      .send({ [field]: value })
      .expect(200);
    const res = await agent.get(`/employees/${created.id}`).expect(200);
    const shown =
      field === 'payAnnual' ? res.body.payAnnualMinor : res.body[field];
    expect(shown).toBe(field === 'payAnnual' ? 6100000 : value);
  });

  it('replaces the manager so the record has one (AC6)', async () => {
    const admin = await makePerson('hr_admin');
    const a = await makePerson('manager');
    const b = await makePerson('manager');
    const agent = await signedIn(admin.user.email);
    const created = await createEmployee(agent, a.employee.id);
    await agent
      .patch(`/employees/${created.id}`)
      .send({ managerId: b.employee.id })
      .expect(200);
    const stored = await ds
      .getRepository(Employee)
      .findOneByOrFail({ id: created.id });
    expect(stored.managerId).toBe(b.employee.id);
    const res = await agent.get(`/employees/${created.id}`).expect(200);
    expect(res.body.managerId).toBe(b.employee.id);
  });

  it('shows only the new job title (AC7)', async () => {
    const admin = await makePerson('hr_admin');
    const boss = await makePerson('manager');
    const agent = await signedIn(admin.user.email);
    const created = await createEmployee(agent, boss.employee.id, {
      jobTitle: 'X',
    });
    const res = await agent
      .patch(`/employees/${created.id}`)
      .send({ jobTitle: 'Y' })
      .expect(200);
    expect(res.body.jobTitle).toBe('Y');
    expect(JSON.stringify(res.body)).not.toContain('"X"');
  });

  it('refuses a duplicate contact email in any casing (AC8)', async () => {
    const admin = await makePerson('hr_admin');
    const boss = await makePerson('manager');
    const agent = await signedIn(admin.user.email);
    const email = `dup${unique()}@acme.example`;
    await createEmployee(agent, boss.employee.id, { contactEmail: email });
    const before = await ds.getRepository(Employee).count();
    const res = await agent
      .post('/employees')
      .send(
        validBody({
          managerId: boss.employee.id,
          contactEmail: email.toUpperCase(),
        }),
      )
      .expect(409);
    expect(res.body.code).toBe('contact_email_taken');
    expect(await ds.getRepository(Employee).count()).toBe(before);
  });

  it('allows a matching name with a different email (AC9)', async () => {
    const admin = await makePerson('hr_admin');
    const boss = await makePerson('manager');
    const agent = await signedIn(admin.user.email);
    const displayName = `Same Name ${unique()}`;
    await createEmployee(agent, boss.employee.id, { displayName });
    await createEmployee(agent, boss.employee.id, { displayName });
    expect(
      await ds.getRepository(Employee).count({ where: { displayName } }),
    ).toBe(2);
  });

  it('refuses non-HR edits of job, manager and pay (AC10)', async () => {
    const hr = await makePerson('hr_admin');
    const boss = await makePerson('manager');
    const report = await makePerson('employee', boss.employee.id);
    const exec = await makePerson('read_only_executive');
    const patch = {
      jobTitle: 'Hacked',
      managerId: hr.employee.id,
      payAnnual: 1,
    };
    for (const who of [report, boss, exec]) {
      const agent = await signedIn(who.user.email);
      await agent
        .patch(`/employees/${report.employee.id}`)
        .send(patch)
        .expect(403);
    }
    const stored = await ds
      .getRepository(Employee)
      .findOneByOrFail({ id: report.employee.id });
    expect(stored.managerId).toBe(boss.employee.id);
    expect(stored.jobTitle).toBeNull();
  });

  it('sets a designated executive as the only manager (AC11)', async () => {
    const admin = await makePerson('hr_admin');
    const exec = await makePerson('read_only_executive', null, 'Ada Lindqvist');
    const top = await makePerson('manager');
    const agent = await signedIn(admin.user.email);
    await agent
      .patch(`/employees/${top.employee.id}`)
      .send({ managerId: exec.employee.id })
      .expect(200);
    const stored = await ds
      .getRepository(Employee)
      .findOneByOrFail({ id: top.employee.id });
    expect(stored.managerId).toBe(exec.employee.id);
    const options = await agent.get('/employees/options').expect(200);
    expect(options.body.managers).toContainEqual({
      id: exec.employee.id,
      displayName: 'Ada Lindqvist',
      isExecutive: true,
    });
  });

  it('still returns an old row that has none of the new fields', async () => {
    const admin = await makePerson('hr_admin');
    const old = await makePerson('employee');
    const agent = await signedIn(admin.user.email);
    const res = await agent.get(`/employees/${old.employee.id}`).expect(200);
    expect(res.body.jobTitle).toBeNull();
    const own = await (
      await signedIn(old.user.email)
    )
      .get('/employees/me')
      .expect(200);
    expect(own.body.contactEmail).toBeNull();
  });
});
