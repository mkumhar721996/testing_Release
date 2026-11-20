import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { DefectStatus } from './defect-transitions';

@Entity('defects')
export class Defect {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Human-readable ID, e.g. DEF-1042; used in URLs and to name an original defect. */
  @Column({ type: 'varchar', unique: true })
  key!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'varchar' })
  severity!: string;

  @Column({ type: 'varchar' })
  component!: string;

  @Column({ type: 'varchar' })
  reporterName!: string;

  /** Plain text until assignment is built. */
  @Column({ type: 'varchar', nullable: true })
  ownerName!: string | null;

  @Column({ type: 'varchar' })
  environment!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  stepsToReproduce!: string[];

  @Column({ type: 'varchar', default: 'New' })
  status!: DefectStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
