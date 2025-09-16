// src/middleware/requireRole.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "./verifyToken";

export const requireRole = (role: "admin" | "supervisor" | "attendant") => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      return res.status(403).json({ success: false, message: "Forbidden - no role present" });
    }
    if (req.userRole !== role) {
      return res.status(403).json({ success: false, message: "Forbidden - insufficient privileges" });
    }
    next();
  };
};
