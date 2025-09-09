import { Request, Response } from "express";
// import pool from "../config/db";

export const getUsers = async (req: Request, res: Response) => {
  try {
    // const result = await pool.query("SELECT NOW()");
    // res.json({ serverTime: result.rows[0] });
    res.json({ message: "Get all users - Placeholder" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
};
