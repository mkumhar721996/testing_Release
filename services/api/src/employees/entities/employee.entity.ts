import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const EMPLOYEE_STATUSES = ['active', 'on_leave', 'inactive'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ default: '' })
  role!: string;

  @Column({ default: '' })
  department!: string;

  @Column({ type: 'varchar', default: 'active' })
  status!: EmployeeStatus;
}
