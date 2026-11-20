import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** One hand-set balance per (employee, leave type); no row means "not set". */
@Entity('leave_balances')
@Unique(['employeeId', 'leaveTypeId'])
export class LeaveBalance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  employeeId!: string;

  @Column({ type: 'uuid' })
  leaveTypeId!: string;

  @Column({ type: 'int' })
  days!: number;
}
