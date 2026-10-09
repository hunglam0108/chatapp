import jwt from "jsonwebtoken";
import User from "../models/User.ts";

export const socketAuthMiddleware = async (socket: any, next: any) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Unauthorized - Token không tồn tại"));
    }

    // Same secret the REST auth uses to sign access tokens (authController).
    const decoded = jwt.verify(
      token,
      (process.env.ACCESS_TOKEN || "") as string
    );
    if (!decoded) {
      return next(new Error("Unauthorized - Token không hợp lệ hoặc đã hết hạn"));
    }

    const user = await User.findById(decoded.userId).select("-hashedPassword");

    if (!user) {
      return next(new Error("User không tồn tại"));
    }

    socket.user = user;

    next();
  } catch (error) {
    console.error("Lỗi khi verify JWT trong socketMiddleware", error);
    next(new Error("Unauthorized"));
  }
};