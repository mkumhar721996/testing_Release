import { Repository } from 'typeorm';
import { LeaveBalance } from './leave-balance.entity';
import { LeaveEntry } from './leave-entry.entity';
import { LeaveType } from './leave-type.entity';
import { LeaveTypesService } from './leave-types.service';

describe('LeaveTypesService', () => {
  const build = (
    opts: { types?: LeaveType[]; balances?: number; entries?: number } = {},
  ) => {
    const types = opts.types ?? [];
    const repo = {
      find: jest.fn().mockResolvedValue(types),
      findOneBy: jest
        .fn()
        .mockImplementation(({ id }: { id: string }) =>
          Promise.resolve(types.find((t) => t.id === id) ?? null),
        ),
      create: jest.fn().mockImplementation((v: unknown) => v),
      save: jest.fn().mockImplementation((v: unknown) => Promise.resolve(v)),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const balances = {
      countBy: jest.fn().mockResolvedValue(opts.balances ?? 0),
      createQueryBuilder: jest.fn(),
    };
    const entries = { countBy: jest.fn().mockResolvedValue(opts.entries ?? 0) };
    const service = new LeaveTypesService(
      repo as unknown as Repository<LeaveType>,
      balances as unknown as Repository<LeaveBalance>,
      entries as unknown as Repository<LeaveEntry>,
    );
    return { service, repo, balances, entries };
  };
  const annual: LeaveType = { id: 'annual', name: 'Annual leave', exempt: false };

  it('creates a leave type with a trimmed name (AC1)', async () => {
    const { service, repo } = build();
    await expect(
      service.create({ name: '  Annual leave ' }),
    ).resolves.toMatchObject({ name: 'Annual leave', exempt: false });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Annual leave', exempt: false }),
    );
  });

  it('rejects blank and duplicate names', async () => {
    const { service } = build({ types: [annual] });
    await expect(service.create({ name: '   ' })).rejects.toMatchObject({
      response: { code: 'leave_type_name_invalid' },
    });
    await expect(service.create({ name: 'annual LEAVE' })).rejects.toMatchObject(
      { response: { code: 'leave_type_name_taken' } },
    );
  });

  it('turns exempt on and off (AC6, AC7)', async () => {
    const { service, repo } = build({
      types: [{ id: 'unpaid', name: 'Unpaid leave', exempt: false }],
    });
    await service.update('unpaid', { exempt: true });
    expect(repo.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ exempt: true }),
    );
    await service.update('unpaid', { exempt: false });
    expect(repo.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ exempt: false }),
    );
  });

  it('renames a leave type (AC8)', async () => {
    const { service, repo } = build({ types: [{ ...annual }] });
    await service.update('annual', { name: 'Annual holiday' });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'annual', name: 'Annual holiday' }),
    );
  });

  it('refuses renaming to another type name', async () => {
    const { service } = build({
      types: [{ ...annual }, { id: 'sick', name: 'Sick leave', exempt: false }],
    });
    await expect(
      service.update('annual', { name: 'sick leave' }),
    ).rejects.toMatchObject({ response: { code: 'leave_type_name_taken' } });
  });

  it('reports an unknown id as not found', async () => {
    const { service } = build();
    await expect(service.update('x', { exempt: true })).rejects.toMatchObject({
      response: { code: 'leave_type_not_found' },
    });
  });

  it('deletes an unused leave type (AC9)', async () => {
    const { service, repo } = build({ types: [annual] });
    await service.remove('annual');
    expect(repo.delete).toHaveBeenCalledWith({ id: 'annual' });
  });

  it('refuses deleting a type with a balance (AC10)', async () => {
    const { service, repo } = build({ types: [annual], balances: 1 });
    await expect(service.remove('annual')).rejects.toMatchObject({
      response: { code: 'leave_type_in_use' },
    });
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('refuses deleting a type a leave entry uses', async () => {
    const { service, repo } = build({ types: [annual], entries: 1 });
    await expect(service.remove('annual')).rejects.toMatchObject({
      response: { code: 'leave_type_in_use' },
    });
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
