import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Product } from "./Product";

@Entity({ name: "scans" })
export class Scan {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "integer", nullable: true })
  product_id?: number;

  @Column({ type: "text", nullable: true })
  scan_image_url?: string;

  @Column({ type: "text", nullable: true })
  ocr_text?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  barcode_scanned?: string;

  @Column({ type: "decimal", precision: 5, scale: 2, nullable: true })
  similarity_score?: number;

  @Column({ type: "jsonb", nullable: true })
  discrepancy_notes?: any;

  @CreateDateColumn({ type: "timestamp" })
  created_at!: Date;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: "product_id" })
  product?: Product;
}