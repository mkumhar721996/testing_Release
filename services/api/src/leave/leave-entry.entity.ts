import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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
}
