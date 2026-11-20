import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** One row per (employee, leave type); no row means the balance is not set. */
@Entity('leave_balances')
@Unique(['employeeId', 'leaveTypeId'])
export class LeaveBalance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  employeeId!: string;

  @Column({ type: 'uuid' })
  leaveTypeId!: string;

  /** Whole days, 0 or more. */
  @Column({ type: 'int' })
  days!: number;
}
