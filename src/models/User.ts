// BEFORE
// import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

// @Entity({ name: "users" })
// export class User {
//   @PrimaryGeneratedColumn()
//   id!: number;

//   @Column({ type: "varchar", length: 255 })
//   name!: string;

//   @Column({ 
//     type: "enum", 
//     enum: ["attendant", "supervisor"],
//     default: "attendant"
//   })
//   role!: 'attendant' | 'supervisor';

//   @CreateDateColumn({ type: "timestamp" })
//   created_at!: Date;
// }


// src/models/User.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  // username for login (unique)
  @Column({ type: "varchar", length: 255, unique: true })
  username!: string;

  // hashed password
  @Column({ type: "varchar", length: 255 })
  password!: string;

  @Column({
    type: "enum",
    enum: ["attendant", "supervisor"],
    default: "attendant"
  })
  role!: "attendant" | "supervisor";

  @CreateDateColumn({ type: "timestamp" })
  created_at!: Date;
}
