import { QueryRunner } from 'typeorm';
import { AddLeaveEntryStatus1763600000000 } from './1763600000000-AddLeaveEntryStatus';

describe('AddLeaveEntryStatus migration', () => {
  it('adds an idempotent status column defaulting to approved', async () => {
    const q = { query: jest.fn() } as unknown as QueryRunner;
    await new AddLeaveEntryStatus1763600000000().up(q);
    expect(q.query).toHaveBeenCalledWith(
      expect.stringContaining(`ADD COLUMN IF NOT EXISTS "status"`),
    );
    expect(q.query).toHaveBeenCalledWith(
      expect.stringContaining(`DEFAULT 'approved'`),
    );
  });

  it('drops the column on down', async () => {
    const q = { query: jest.fn() } as unknown as QueryRunner;
    await new AddLeaveEntryStatus1763600000000().down(q);
    expect(q.query).toHaveBeenLastCalledWith(
      expect.stringContaining(`DROP COLUMN IF EXISTS "status"`),
    );
  });
});
