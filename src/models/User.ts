import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ 
    type: "enum", 
    enum: ["attendant", "supervisor"],
    default: "attendant"
  })
  role!: 'attendant' | 'supervisor';

  @CreateDateColumn({ type: "timestamp" })
  created_at!: Date;
}