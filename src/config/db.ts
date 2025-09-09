import { Pool } from "pg";

const pool = new Pool({
  user: "postgres",       // default postgres user
  host: "localhost",      // database host
  database: "oriondb",     // name of my database
  password: process.env.DB_PASSWORD, // my postgres password
  port: 5432,             // default postgres port
});

export const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database');
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

export default pool;
