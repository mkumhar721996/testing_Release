import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** One change to a business record, written in the same transaction as the change (ADR-0028). */
@Entity('audit_entries')
export class AuditEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  actorUserId!: string;

  @Column({ type: 'varchar' })
  entity!: string;

  @Column({ type: 'uuid' })
  entityId!: string;

  @Column({ type: 'varchar' })
  action!: 'create' | 'update';

  @Column({ type: 'jsonb' })
  changes!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
