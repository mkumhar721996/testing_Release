import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ActivationService } from '../auth/activation.service';
import { Session } from '../auth/entities/session.entity';
import { User } from '../auth/entities/user.entity';
import { ROLES } from '../auth/role';
import { SessionService } from '../auth/session.service';
import { FakeClock, FakeRepo, fakeCognito } from '../auth/testing/fakes';
import { Employee } from '../employees/employee.entity';
import { UsersAdminService } from './users-admin.service';

const t0 = new Date('2026-01-01T00:00:00Z');

describe('UsersAdminService', () => {
  let cognito: ReturnType<typeof fakeCognito>;
  let users: FakeRepo<User>;
  let employees: FakeRepo<Employee>;
  let sessionRepo: FakeRepo<Session>;
  let sessions: SessionService;
  let activation: { issue: jest.Mock };
  let notifier: { notify: jest.Mock };
  let service: UsersAdminService;

  const addUser = (email: string, status: User['status'], role = 'employee') =>
    users.save({
      email,
      cognitoSub: `sub-${email}`,
      status,
      role,
      failedSignInCount: 3,
      lockStartedAt: t0,
    } as User);
  const stored = (id: string) => users.findOneByOrFail({ id });

  beforeEach(() => {
    process.env.SESSION_ENCRYPTION_KEY = 'test-encryption-key';
    cognito = fakeCognito();
    cognito.createUser.mockResolvedValue({ sub: 'new-sub' });
    users = new FakeRepo<User>();
    employees = new FakeRepo<Employee>();
    sessionRepo = new FakeRepo<Session>();
    sessions = new SessionService(
      sessionRepo as unknown as Repository<Session>,
      new FakeClock(t0),
    );
    activation = {
      issue: jest.fn().mockResolvedValue({ token: 'tok', expiresAt: t0 }),
    };
    notifier = { notify: jest.fn().mockResolvedValue(undefined) };
    service = new UsersAdminService(
      users as unknown as Repository<User>,
      employees as unknown as Repository<Employee>,
      sessions,
      activation as unknown as ActivationService,
      cognito,
      notifier,
    );
  });

  it('offers exactly four roles (AC3)', () => {
    expect(ROLES).toEqual(['employee', 'manager', 'hr_admin', 'read_only_executive']);
  });

  it('lists every user with role and status (AC1)', async () => {
    const a = await addUser('a@x.com', 'active');
    await employees.save({ userId: a.id, displayName: 'Ann', managerId: null } as Employee);
    await addUser('b@x.com', 'deactivated', 'manager');
    const list = await service.list();
    expect(list).toEqual(
      expect.arrayContaining([
        { id: a.id, email: 'a@x.com', displayName: 'Ann', role: 'employee', status: 'active' },
        expect.objectContaining({ email: 'b@x.com', displayName: null, status: 'deactivated' }),
      ]),
    );
    expect(list).toHaveLength(2);
  });

  describe('invite', () => {
    const input = { email: ' New@X.com ', displayName: ' New Joiner ', role: 'manager' };

    it('creates a pending user with the chosen role, employee row, token and notice (AC2)', async () => {
      const view = await service.invite(input);
      expect(cognito.createUser).toHaveBeenCalledWith('new@x.com');
      expect(view).toMatchObject({
        email: 'new@x.com',
        displayName: 'New Joiner',
        role: 'manager',
        status: 'pending',
      });
      expect(users.rows[0].cognitoSub).toBe('new-sub');
      expect(employees.rows[0]).toMatchObject({ userId: view.id, displayName: 'New Joiner' });
      expect(activation.issue).toHaveBeenCalledWith(view.id);
      expect(notifier.notify).toHaveBeenCalledTimes(1);
    });

    it.each([undefined, ['manager', 'employee'], 'boss', ''])(
      'refuses role %p and creates nothing (AC5, AC11)',
      async (role) => {
        await expect(
          service.invite({ ...input, role } as never),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(cognito.createUser).not.toHaveBeenCalled();
        expect(notifier.notify).not.toHaveBeenCalled();
        expect(users.rows).toHaveLength(0);
      },
    );

    it('refuses a missing name or email', async () => {
      await expect(
        service.invite({ ...input, displayName: ' ' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.invite({ ...input, email: 'nope' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a duplicate email', async () => {
      await addUser('new@x.com', 'active');
      await expect(service.invite(input as never)).rejects.toBeInstanceOf(ConflictException);
      expect(cognito.createUser).not.toHaveBeenCalled();
    });

    it('leaves no user row behind when the employee row fails', async () => {
      employees.save = jest.fn().mockRejectedValue(new Error('db down'));
      await expect(service.invite(input as never)).rejects.toThrow('db down');
      expect(users.rows).toHaveLength(0);
      expect(notifier.notify).not.toHaveBeenCalled();
    });
  });

  describe('changeRole', () => {
    it('replaces the role (AC4)', async () => {
      const u = await addUser('a@x.com', 'active', 'employee');
      const view = await service.changeRole(u.id, 'hr_admin');
      expect(view.role).toBe('hr_admin');
      expect((await stored(u.id)).role).toBe('hr_admin');
    });

    it('refuses an array or unknown role (AC5)', async () => {
      const u = await addUser('a@x.com', 'active');
      await expect(service.changeRole(u.id, ['manager', 'employee'] as never)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.changeRole(u.id, 'x' as never)).rejects.toBeInstanceOf(BadRequestException);
      expect((await stored(u.id)).role).toBe('employee');
    });

    it('404s for an unknown user', async () => {
      await expect(service.changeRole('nope', 'manager')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('marks the account deactivated, ends sessions and disables Cognito (AC6, AC9)', async () => {
      const u = await addUser('b@x.com', 'active');
      await sessions.create(u.id, 'refresh-token');
      const view = await service.deactivate(u.id);
      expect(view.status).toBe('deactivated');
      expect((await stored(u.id)).status).toBe('deactivated');
      expect(sessionRepo.rows.every((s) => s.endedAt !== null)).toBe(true);
      expect(cognito.signOut).toHaveBeenCalledWith('refresh-token');
      expect(cognito.disableUser).toHaveBeenCalledWith('b@x.com');
    });

    it('still deactivates when Cognito revocation fails', async () => {
      const u = await addUser('b@x.com', 'active');
      await sessions.create(u.id, 'r');
      cognito.signOut.mockRejectedValue(new Error('down'));
      cognito.disableUser.mockRejectedValue(new Error('down'));
      await expect(service.deactivate(u.id)).resolves.toMatchObject({ status: 'deactivated' });
      expect((await stored(u.id)).status).toBe('deactivated');
    });

    it('refuses a non-active account', async () => {
      const u = await addUser('b@x.com', 'deactivated');
      await expect(service.deactivate(u.id)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('reactivate', () => {
    it('re-enables the account and clears lockout (AC7)', async () => {
      const u = await addUser('b@x.com', 'deactivated');
      const view = await service.reactivate(u.id);
      expect(view.status).toBe('active');
      expect(cognito.enableUser).toHaveBeenCalledWith('b@x.com');
      expect(await stored(u.id)).toMatchObject({
        status: 'active',
        failedSignInCount: 0,
        lockStartedAt: null,
      });
    });

    it('refuses a non-deactivated account', async () => {
      const u = await addUser('b@x.com', 'active');
      await expect(service.reactivate(u.id)).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
