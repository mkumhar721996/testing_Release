import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type UserStatus = 'pending' | 'active';
export type UserRole = 'hr_admin' | 'manager';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  cognitoSub!: string;

  @Column({ type: 'varchar', default: 'pending' })
  status!: UserStatus;

  @Column({ type: 'varchar', default: 'manager' })
  role!: UserRole;

  @Column({ type: 'int', default: 0 })
  failedSignInCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lockStartedAt!: Date | null;
}
