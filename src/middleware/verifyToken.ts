// src/middleware/verifyToken.ts
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: "attendant" | "supervisor";
}

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = (req.cookies && (req.cookies as any).securedToken) || req.headers["authorization"]?.toString().replace("Bearer ", "");

  if (!token) {
    res.status(401).json({ success: false, message: "Unauthorized - no token provided" });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload & { userId: number; role: "attendant" | "supervisor" };

    if (!decoded || !decoded.userId) {
      res.status(401).json({ success: false, message: "Unauthorized - invalid token" });
      return;
    }

    req.userId = Number(decoded.userId);
    req.userRole = decoded.role;
    next();
  } catch (err) {
    console.error("Error in verifyToken:", err);
    res.status(401).json({ success: false, message: "Unauthorized - invalid token" });
  }
};
