import { DataSource, Repository } from 'typeorm';
import { AuditEntry } from '../audit/audit-entry.entity';
import { LeaveBalance } from './leave-balance.entity';
import { LeaveEntry } from './leave-entry.entity';
import { LeaveType } from './leave-type.entity';
import { LeaveTypesService } from './leave-types.service';

describe('LeaveTypesService', () => {
  const annual = { id: 'annual', name: 'Annual leave', exempt: false };
  const unpaid = { id: 'unpaid', name: 'Unpaid leave', exempt: false };

  const setup = (
    opts: { balances?: number; entries?: number; rows?: LeaveType[] } = {},
  ) => {
    const rows = opts.rows ?? [annual, unpaid];
    const em = {
      save: jest.fn(async (_t, v) => ({ id: 'new1', ...v })),
      delete: jest.fn().mockResolvedValue(undefined),
      findOneBy: jest.fn(async (_t, w: { id: string }) =>
        rows.find((r) => r.id === w.id) ?? null,
      ),
      find: jest.fn().mockResolvedValue(rows),
      countBy: jest.fn(async (t) =>
        t === LeaveBalance ? (opts.balances ?? 0) : (opts.entries ?? 0),
      ),
    };
    const dataSource = { transaction: jest.fn(async (fn) => fn(em)) };
    const service = new LeaveTypesService(
      dataSource as unknown as DataSource,
      {} as Repository<LeaveType>,
    );
    return { service, em };
  };

  it('creates a trimmed leave type and audits it (AC1)', async () => {
    const { service, em } = setup();
    await expect(
      service.create({ name: '  Sick leave ' }, 'u1'),
    ).resolves.toMatchObject({ name: 'Sick leave', exempt: false });
    expect(em.save).toHaveBeenCalledWith(
      LeaveType,
      expect.objectContaining({ name: 'Sick leave', exempt: false }),
    );
    expect(em.save).toHaveBeenCalledWith(
      AuditEntry,
      expect.objectContaining({ entity: 'leave_type', action: 'create' }),
    );
  });

  it('rejects a blank name and a case-insensitive duplicate', async () => {
    const { service, em } = setup();
    await expect(service.create({ name: '   ' }, 'u1')).rejects.toMatchObject({
      response: { code: 'leave_type_name_invalid' },
    });
    await expect(
      service.create({ name: 'annual LEAVE' }, 'u1'),
    ).rejects.toMatchObject({ response: { code: 'leave_type_name_taken' } });
    expect(em.save).not.toHaveBeenCalled();
  });

  it('rejects a non-boolean exempt', async () => {
    const { service } = setup();
    await expect(
      service.create({ name: 'X', exempt: 'yes' as unknown as boolean }, 'u1'),
    ).rejects.toMatchObject({ response: { code: 'leave_type_exempt_invalid' } });
  });

  it('turns exempt on and off (AC6, AC7)', async () => {
    const { service, em } = setup();
    await service.update('unpaid', { exempt: true }, 'u1');
    expect(em.save).toHaveBeenCalledWith(
      LeaveType,
      expect.objectContaining({ id: 'unpaid', exempt: true }),
    );
    expect(em.save).toHaveBeenCalledWith(
      AuditEntry,
      expect.objectContaining({ entity: 'leave_type', action: 'update' }),
    );
  });

  it('renames, but not to another type name in any case', async () => {
    const { service, em } = setup();
    await service.update('annual', { name: 'Annual holiday' }, 'u1');
    expect(em.save).toHaveBeenCalledWith(
      LeaveType,
      expect.objectContaining({ name: 'Annual holiday' }),
    );
    await expect(
      service.update('annual', { name: 'UNPAID leave' }, 'u1'),
    ).rejects.toMatchObject({ response: { code: 'leave_type_name_taken' } });
  });

  it('allows changing only the case of its own name', async () => {
    const { service, em } = setup();
    await service.update('annual', { name: 'ANNUAL LEAVE' }, 'u1');
    expect(em.save).toHaveBeenCalledWith(
      LeaveType,
      expect.objectContaining({ id: 'annual', name: 'ANNUAL LEAVE' }),
    );
  });

  it('rejects a blank rename and a non-boolean exempt on update', async () => {
    const { service, em } = setup();
    await expect(service.update('annual', { name: ' ' }, 'u1')).rejects.toMatchObject({
      response: { code: 'leave_type_name_invalid' },
    });
    await expect(
      service.update('annual', { exempt: 1 as unknown as boolean }, 'u1'),
    ).rejects.toMatchObject({ response: { code: 'leave_type_exempt_invalid' } });
    expect(em.save).not.toHaveBeenCalled();
  });

  it('writes no audit entry when a delete is refused', async () => {
    const { service, em } = setup({ entries: 1 });
    await expect(service.remove('annual', 'u1')).rejects.toBeDefined();
    expect(em.save).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown leave type', async () => {
    const { service } = setup();
    await expect(service.update('nope', { exempt: true }, 'u1')).rejects.toMatchObject(
      { response: { code: 'leave_type_not_found' } },
    );
  });

  it('deletes an unused type and audits it', async () => {
    const { service, em } = setup();
    await service.remove('annual', 'u1');
    expect(em.delete).toHaveBeenCalledTimes(1);
    expect(em.save).toHaveBeenCalledWith(
      AuditEntry,
      expect.objectContaining({ action: 'delete' }),
    );
  });

  it.each([{ balances: 2 }, { entries: 1 }])(
    'refuses to delete a type in use %p',
    async (opts) => {
      const { service, em } = setup(opts);
      await expect(service.remove('annual', 'u1')).rejects.toMatchObject({
        response: { code: 'leave_type_in_use' },
      });
      expect(em.delete).not.toHaveBeenCalled();
      expect(LeaveEntry).toBeDefined();
    },
  );
});
