import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { AuditEntry } from '../audit/audit-entry.entity';
import { Employee } from './employee.entity';
import { EmployeesService } from './employees.service';

describe('EmployeesService', () => {
  const row = { id: 'e1', userId: 'u1', displayName: 'New', managerId: null };
  const boss = '11111111-1111-4111-8111-111111111111';
  const body = {
    displayName: ' Priya Shah ',
    jobTitle: 'Recruiter',
    department: 'People',
    managerId: boss,
    payAnnual: 52000,
    contactEmail: ' Priya.Shah@Acme.Example ',
    phone: '+44 20 7946 0188',
  };

  const setup = (
    overrides: { save?: jest.Mock; existsBy?: jest.Mock } = {},
  ) => {
    const manager = {
      existsBy: overrides.existsBy ?? jest.fn().mockResolvedValue(true),
      save: overrides.save ?? jest.fn(async (_t, v) => ({ id: 'new1', ...v })),
      update: jest.fn().mockResolvedValue(undefined),
      findOneBy: jest.fn().mockResolvedValue(row),
      create: jest.fn((_t, v) => v),
      insert: jest.fn().mockResolvedValue(undefined),
    };
    const dataSource = {
      transaction: jest.fn(async (fn) => fn(manager)),
    };
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([row]),
    };
    const repo = {
      update: jest.fn().mockResolvedValue(undefined),
      findOneBy: jest.fn().mockResolvedValue(row),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    const config = {
      get: jest.fn((key: string, fallback: string) =>
        key === 'EMPLOYEE_DEPARTMENTS' ? 'People,Finance' : fallback,
      ),
    };
    const service = new EmployeesService(
      repo as unknown as Repository<Employee>,
      dataSource as unknown as DataSource,
      config as unknown as ConfigService,
    );
    return { service, manager, repo, qb, dataSource };
  };

  it('renames through update and returns the stored row', async () => {
    const { service, manager } = setup();
    await expect(service.rename('e1', 'New', 'actor1')).resolves.toEqual(row);
    expect(manager.update).toHaveBeenCalledWith(
      Employee,
      { id: 'e1' },
      { displayName: 'New' },
    );
  });

  it('searches by name with an ILIKE (AC1)', async () => {
    const { service, qb } = setup();
    await service.search('priya');
    expect(qb.where).toHaveBeenCalledWith('e."displayName" ILIKE :q', {
      q: '%priya%',
    });
    expect(qb.take).toHaveBeenCalledWith(50);
  });

  it('creates a normalised record and audits it in one transaction (AC3)', async () => {
    const { service, manager, dataSource } = setup();
    await service.create(body, 'actor1');
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.save).toHaveBeenCalledWith(
      Employee,
      expect.objectContaining({
        displayName: 'Priya Shah',
        contactEmail: 'priya.shah@acme.example',
        payAnnualMinor: 5200000,
        payCurrency: 'GBP',
        managerId: boss,
      }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      AuditEntry,
      expect.objectContaining({ actorUserId: 'actor1', action: 'create' }),
    );
  });

  it('refuses a create with no manager and saves nothing (AC4)', async () => {
    const { service, manager } = setup();
    const { managerId: _omit, ...noManager } = body;
    await expect(service.create(noManager, 'actor1')).rejects.toMatchObject({
      response: { code: 'manager_required' },
    });
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('refuses a manager that does not exist', async () => {
    const { service } = setup({ existsBy: jest.fn().mockResolvedValue(false) });
    await expect(service.create(body, 'actor1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('maps a unique-email violation to a conflict (AC8)', async () => {
    const save = jest.fn().mockRejectedValue({ code: '23505' });
    const { service, repo } = setup({ save });
    repo.findOneBy.mockResolvedValue({ id: 'other' });
    await expect(service.create(body, 'actor1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.create(body, 'actor1')).rejects.toMatchObject({
      response: { code: 'contact_email_taken', employeeId: 'other' },
    });
  });

  it('does not check the name for uniqueness (AC9)', async () => {
    const { service, repo } = setup();
    await service.create(body, 'actor1');
    expect(repo.findOneBy).not.toHaveBeenCalled();
  });

  it('replaces the manager outright on update (AC6)', async () => {
    const { service, manager } = setup();
    await service.update('e1', { managerId: boss }, 'actor1');
    expect(manager.update).toHaveBeenCalledWith(
      Employee,
      { id: 'e1' },
      { managerId: boss },
    );
  });
});
