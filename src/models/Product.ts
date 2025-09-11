
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity({ name: "products" })
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "varchar", length: 255, unique: true, nullable: true })
  barcode?: string;

  @Column({ type: "text", nullable: true })
  expected_verbage?: string;

  @Column({ type: "jsonb", nullable: true })
  expected_ingredients?: any;

  @Column({ type: "text", nullable: true })
  reference_image_url?: string;

  @CreateDateColumn({ type: "timestamp" })
  created_at!: Date;
}
