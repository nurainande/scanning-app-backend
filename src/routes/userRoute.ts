// src/routes/authRoute.ts
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/db";
import { User } from "../models/User";

const router = Router();
const userRepo = () => AppDataSource.getRepository(User);

// Register: creates a user (default role = attendant)
router.post("/register", async (req, res) => {
  try {
    const { name, username, password, role } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ success: false, message: "name, username and password are required" });
    }

    const existing = await userRepo().findOneBy({ username });
    if (existing) {
      return res.status(400).json({ success: false, message: "Username already taken" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = userRepo().create({
      name,
      username,
      password: hashed,
      role: role === "supervisor" ? "supervisor" : "attendant"
    });

    const saved = await userRepo().save(user);
    // don't return password
    const { password: _p, ...userSafe } = saved as any;
    return res.status(201).json({ success: true, user: userSafe });
  } catch (err) {
    console.error("Register err:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Login: set JWT in httpOnly cookie
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "username and password required" });
    }

    const user = await userRepo().findOneBy({ username });
    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "8h" }
    );

    res.cookie("securedToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000 // 8 hours
    });

    const { password: _p, ...userSafe } = user as any;
    return res.json({ success: true, message: "Login successful", user: userSafe });
  } catch (err) {
    console.error("Login err:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Logout - clears cookie
router.post("/logout", (req, res) => {
  res.clearCookie("securedToken");
  return res.json({ success: true, message: "Logged out" });
});

// GET /api/auth/me
router.get("/me", async (req, res) => {
  try {
    const token = (req.cookies && (req.cookies as any).securedToken);
    if (!token) return res.status(200).json({ user: null });

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    const user = await userRepo().findOneBy({ id: Number(decoded.userId) });
    if (!user) return res.status(200).json({ user: null });

    const { password: _p, ...userSafe } = user as any;
    return res.json({ user: userSafe });
  } catch (err) {
    return res.status(200).json({ user: null });
  }
});


export default router;
