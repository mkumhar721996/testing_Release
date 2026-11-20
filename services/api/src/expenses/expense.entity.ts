import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  ownerUserId!: string;

  /** Amount in minor currency units. */
  @Column({ type: 'int' })
  amountMinor!: number;

  @Column({ type: 'varchar' })
  currency!: string;

  /** The calendar day the money was spent. */
  @Column({ type: 'date' })
  incurredOn!: string;

  @Column({ type: 'varchar', nullable: true })
  category!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** Object Storage key of the receipt; only metadata lives here (ADR-0019). */
  @Column({ type: 'varchar', nullable: true })
  receiptKey!: string | null;

  @Column({ type: 'varchar', nullable: true })
  receiptName!: string | null;

  @Column({ type: 'varchar', nullable: true })
  receiptContentType!: string | null;

  @Column({ type: 'int', nullable: true })
  receiptSizeBytes!: number | null;

  @Column({ type: 'varchar', default: 'draft' })
  status!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
