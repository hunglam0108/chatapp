import { Server } from "socket.io";
import type http from "http";
import { socketAuthMiddleware } from "../middlewares/socketMiddleware.ts";
import { getUserConversationsForSocketIO } from "../controllers/conservationController.ts";

let io: Server | null = null;

/**
 * Attach Socket.IO to the main HTTP server (the same express app that serves
 * the REST API) so REST routes, CORS and cookies all live in one place.
 * Must be called before the server starts listening.
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

/** Accessor for controllers — returns the initialized Socket.IO server. */
export const getIo = (): Server => {
  if (!io) {
    throw new Error("Socket.IO chưa được khởi tạo — gọi initSocket trước");
  }
  return io;
};
