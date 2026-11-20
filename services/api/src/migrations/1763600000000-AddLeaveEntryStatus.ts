import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeaveEntryStatus1763600000000 implements MigrationInterface {
  name = 'AddLeaveEntryStatus1763600000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE IF EXISTS "leave_entries" ADD COLUMN IF NOT EXISTS "status" character varying NOT NULL DEFAULT 'approved'`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE IF EXISTS "leave_entries" DROP COLUMN IF EXISTS "status"`,
    );
  }
}
