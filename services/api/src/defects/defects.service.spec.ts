import { DataSource } from 'typeorm';
import { Actor } from '../access/permissions';
import { AuditEntry } from '../audit/audit-entry.entity';
import { Defect } from './defect.entity';
import { DefectsService } from './defects.service';

const actor = (role: Actor['role']): Actor => ({
  id: 'u1',
  role,
  employeeId: null,
});

describe('DefectsService.move', () => {
  const setup = (status: string, found = true) => {
    const manager = {
      findOneBy: jest
        .fn()
        .mockResolvedValue(found ? { id: 'd1', key: 'DEF-1', status } : null),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const dataSource = {
      transaction: jest.fn(async (fn) => fn(manager)),
    } as unknown as DataSource;
    const repo = { findOneBy: jest.fn() };
    const service = new DefectsService(repo as never, dataSource);
    return { service, manager };
  };

  it('AC15: updates the status and writes an audit entry in the same transaction', async () => {
    const { service, manager } = setup('New');
    await service.move('DEF-1', 'triage', {}, actor('triager'));
    expect(manager.update).toHaveBeenCalledWith(
      Defect,
      { id: 'd1' },
      { status: 'Triaged' },
    );
    expect(manager.save).toHaveBeenCalledWith(
      AuditEntry,
      expect.objectContaining({
        entity: 'defect',
        entityId: 'd1',
        action: 'update',
        changes: { status: { from: 'New', to: 'Triaged' } },
      }),
    );
  });

  it('records the reason and original defect in the audit entry', async () => {
    const { service, manager } = setup('New');
    await service.move(
      'DEF-1',
      'duplicate',
      { originalKey: ' DEF-0988 ' },
      actor('triager'),
    );
    expect(manager.save).toHaveBeenCalledWith(
      AuditEntry,
      expect.objectContaining({
        changes: {
          status: { from: 'New', to: 'Duplicate' },
          originalKey: 'DEF-0988',
        },
      }),
    );
  });

  it('AC2: refuses an illegal move with 409 and writes nothing', async () => {
    const { service, manager } = setup('New');
    await expect(
      service.move('DEF-1', 'start', {}, actor('developer')),
    ).rejects.toMatchObject({ status: 409 });
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('AC12: refuses a non-QA verify with 403 and writes nothing', async () => {
    const { service, manager } = setup('Fixed');
    await expect(
      service.move('DEF-1', 'verify', {}, actor('developer')),
    ).rejects.toMatchObject({ status: 403 });
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('AC7: refuses a duplicate without the original and writes nothing', async () => {
    const { service, manager } = setup('New');
    await expect(
      service.move('DEF-1', 'duplicate', {}, actor('triager')),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'original_required' },
    });
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('refuses a reject without a reason with 400', async () => {
    const { service, manager } = setup('Triaged');
    await expect(
      service.move('DEF-1', 'reject', {}, actor('triager')),
    ).rejects.toMatchObject({ response: { code: 'reason_required' } });
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown defect', async () => {
    const { service } = setup('New', false);
    await expect(
      service.move('DEF-9', 'triage', {}, actor('triager')),
    ).rejects.toMatchObject({ status: 404 });
  });
});
