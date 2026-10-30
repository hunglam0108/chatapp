import { Server } from "socket.io";
import type http from "http";
import { socketAuthMiddleware } from "../middlewares/socketMiddleware.ts";
import { getUserConversationsForSocketIO } from "../controllers/conservationController.ts";
import { registerCallHandlers } from "./callHandlers.ts";

let io: Server | null = null;

/**
 * Gắn Socket.IO vào HTTP server chính (cùng express app phục vụ
 * REST API) để REST routes, CORS và cookie nằm cùng một chỗ.
 * Phải gọi trước khi server bắt đầu listen.
 */
export const initSocket = (httpServer: http.Server) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware);

  const onlineUsers = new Map(); // {userId: socketId}

  io.on("connection", async (socket: any) => {
    const user = socket.user;

    registerCallHandlers(io!, socket);

    onlineUsers.set(user._id.toString(), socket.id);

    io!.emit("online-users", Array.from(onlineUsers.keys()));

    const conversationIds = await getUserConversationsForSocketIO(user._id);
    conversationIds.forEach((id: string) => {
      socket.join(id);
    });

    socket.on("join-conversation", (conversationId: string) => {
      socket.join(conversationId);
    });

    socket.join(user._id.toString());

    socket.on("disconnect", () => {
      onlineUsers.delete(user._id.toString());
      io!.emit("online-users", Array.from(onlineUsers.keys()));
    });
  });

  return io;
};

/** Accessor cho controller — trả về Socket.IO server đã khởi tạo. */
export const getIo = (): Server => {
  if (!io) {
    throw new Error("Socket.IO is not initialized — call initSocket first");
  }
  return io;
};
