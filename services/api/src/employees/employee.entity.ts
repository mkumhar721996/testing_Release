import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

const bigintAsNumber = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Null for an employee HR has recorded who has no sign-in account yet. */
  @Column({ type: 'uuid', unique: true, nullable: true })
  userId!: string | null;

  /** The employee's full name. */
  @Column()
  displayName!: string;

  /** The reporting line: the single Employee this one reports to. */
  @Column({ type: 'uuid', nullable: true })
  managerId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  jobTitle!: string | null;

  @Column({ type: 'varchar', nullable: true })
  department!: string | null;

  /** Annual pay in minor currency units (pence for GBP). */
  @Column({ type: 'bigint', nullable: true, transformer: bigintAsNumber })
  payAnnualMinor!: number | null;

  @Column({ type: 'varchar', nullable: true })
  payCurrency!: string | null;

  /** Stored trimmed and lower-cased, so this unique index is case-insensitive. */
  @Index('employees_contact_email_idx', {
    unique: true,
    where: '"contactEmail" IS NOT NULL',
  })
  @Column({ type: 'varchar', nullable: true })
  contactEmail!: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;
}
