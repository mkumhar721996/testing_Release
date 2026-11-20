import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('leave_types')
export class LeaveType {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  /** Stored only for now; the request-time balance block that honours it comes later. */
  @Column({ type: 'boolean', default: false })
  exempt!: boolean;
}
