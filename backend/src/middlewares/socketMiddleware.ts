import jwt from "jsonwebtoken";
import User from "../models/User.ts";
import type { UserJwtPayload } from "../types/userJwtPayload.ts";

export const socketAuthMiddleware = async (socket: any, next: any) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Unauthorized - Token missing"));
    }

    // Cùng secret mà REST auth dùng để ký access token (authController).
    const decoded = jwt.verify(
      token,
      (process.env.ACCESS_TOKEN || "") as string
    ) as UserJwtPayload;
    if (!decoded) {
      return next(new Error("Unauthorized - Token is invalid or expired"));
    }

    const user = await User.findById(decoded.userId).select("-hashedPassword");

    if (!user) {
      return next(new Error("User not found"));
    }

    socket.user = user;

    next();
  } catch (error) {
    console.error("Error verifying JWT in socketMiddleware", error);
    next(new Error("Unauthorized"));
  }
};