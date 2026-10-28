import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  userId!: string;

  @Column()
  displayName!: string;

  /** The reporting line: the Employee this one reports to. */
  @Column({ type: 'uuid', nullable: true })
  managerId!: string | null;
}
