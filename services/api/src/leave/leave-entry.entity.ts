import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

@Entity('leave_entries')
export class LeaveEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  employeeId!: string;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date' })
  endDate!: string;

  @Column()
  kind!: string;

  /** Existing rows are recorded leave, so they default to approved. */
  @Column({ type: 'varchar', default: 'approved' })
  status!: LeaveStatus;
}
