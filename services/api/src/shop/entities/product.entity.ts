import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  category!: string;

  @Column({ type: 'int' })
  priceCents!: number;

  @Column({ type: 'boolean', default: true })
  available!: boolean;
}
