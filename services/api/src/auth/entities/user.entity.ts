import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { Role } from '../role';

export type UserStatus = 'pending' | 'active' | 'deactivated';

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

  @Column({ type: 'varchar', default: 'employee' })
  role!: Role;

  @Column({ type: 'int', default: 0 })
  failedSignInCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lockStartedAt!: Date | null;
}
