import { DataSource } from "typeorm";
import { Product } from "../models/Product";
import { Scan } from "../models/Scan";
import { User } from "../models/User";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: "postgres",
  password: process.env.DB_PASSWORD,
  database: "oriondb",
  entities: [Product, Scan, User],
  synchronize: true, // Only for development - set to false in production
  logging: false,
});

export const connectDB = async () => {
  try {
    await AppDataSource.initialize();
    console.log('✅ Connected to PostgreSQL database with TypeORM');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

// Keep the old pool for backward compatibility if needed
import { Pool } from "pg";

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "oriondb",
  password: process.env.DB_PASSWORD,
  port: 5432,
});

export default pool;
