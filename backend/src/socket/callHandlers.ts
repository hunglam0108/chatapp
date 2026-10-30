import { randomUUID } from "crypto";
import mongoose from "mongoose";
import type { Server } from "socket.io";
import Conversation from "../models/Conversation.ts";

/**
 * Signaling cho call 1-1 (WebRTC). Server chỉ chuyển tiếp offer/answer/ICE
 * giữa 2 socket của cuộc gọi; media đi P2P và không lưu record nào vào DB.
 */

const RING_TIMEOUT_MS = 30_000;

type Call = {
  id: string;
  conversationId: string;
  callerId: string;
  calleeId: string;
  callerSocketId: string;
  // null khi còn đang đổ chuông (chuông kêu ở mọi tab của callee).
  calleeSocketId: string | null;
  timer: ReturnType<typeof setTimeout> | null;
};

// shortcut: state nằm trong memory nên chỉ đúng với 1 instance backend; scale ngang thì chuyển sang Redis.
const calls = new Map<string, Call>();
const userCalls = new Map<string, string>(); // userId -> callId

const endCall = (io: Server, call: Call, reason: string) => {
  if (calls.get(call.id) !== call) return;
  if (call.timer) clearTimeout(call.timer);
  calls.delete(call.id);
  userCalls.delete(call.callerId);
  userCalls.delete(call.calleeId);

  const payload = { callId: call.id, reason };
  io.to(call.callerSocketId).emit("call:ended", payload);
  io.to(call.calleeSocketId ?? call.calleeId).emit("call:ended", payload);
};

export const registerCallHandlers = (io: Server, socket: any) => {
  const user = socket.user;
  const userId = user._id.toString();

  socket.on("call:invite", async (payload: any, ack: unknown) => {
    const reply = typeof ack === "function" ? ack : () => {};
    try {
      const conversationId = payload?.conversationId;
      if (!mongoose.isValidObjectId(conversationId)) return reply({ error: "invalid" });

      const convo: any = await Conversation.findById(conversationId)
        .select("type participants")
        .lean();
      const memberIds: string[] = convo?.participants.map((p: any) => p.userId.toString()) ?? [];
      if (!convo || convo.type !== "direct" || !memberIds.includes(userId)) {
        return reply({ error: "forbidden" });
      }

      const calleeId = memberIds.find((id) => id !== userId);
      if (!calleeId) return reply({ error: "forbidden" });
      if (userCalls.has(userId) || userCalls.has(calleeId)) return reply({ error: "busy" });
      if (!io.sockets.adapter.rooms.get(calleeId)?.size) return reply({ error: "offline" });

      const call: Call = {
        id: randomUUID(),
        conversationId,
        callerId: userId,
        calleeId,
        callerSocketId: socket.id,
        calleeSocketId: null,
        timer: null,
      };
      calls.set(call.id, call);
      userCalls.set(userId, call.id);
      userCalls.set(calleeId, call.id);
      call.timer = setTimeout(() => endCall(io, call, "no-answer"), RING_TIMEOUT_MS);

      io.to(calleeId).emit("call:incoming", {
        callId: call.id,
        conversationId,
        video: Boolean(payload?.video),
        from: { _id: userId, displayName: user.displayName, avatarUrl: user.avatarUrl ?? null },
      });
      reply({ callId: call.id });
    } catch (error) {
      console.error("Lỗi khi tạo cuộc gọi", error);
      reply({ error: "server" });
    }
  });

  socket.on("call:accept", (payload: any) => {
    const call = calls.get(payload?.callId);
    if (!call || call.calleeId !== userId || call.calleeSocketId) return;

    if (call.timer) clearTimeout(call.timer);
    call.timer = null;
    call.calleeSocketId = socket.id;
    // Các tab khác của callee ngừng đổ chuông.
    socket.to(userId).emit("call:ended", { callId: call.id, reason: "answered-elsewhere" });
    io.to(call.callerSocketId).emit("call:accepted", { callId: call.id });
  });

  socket.on("call:decline", (payload: any) => {
    const call = calls.get(payload?.callId);
    if (!call || call.calleeId !== userId || call.calleeSocketId) return;
    endCall(io, call, "declined");
  });

  socket.on("call:end", (payload: any) => {
    const call = calls.get(payload?.callId);
    if (!call) return;
    // Callee bấm cúp trong lúc còn xin quyền mic/cam (chưa kịp accept) thì tính là từ chối.
    const isRingingCallee = call.calleeId === userId && !call.calleeSocketId;
    if (!isRingingCallee && socket.id !== call.callerSocketId && socket.id !== call.calleeSocketId) return;
    endCall(io, call, isRingingCallee ? "declined" : call.calleeSocketId ? "ended" : "cancelled");
  });

  // Chỉ chuyển tiếp giữa đúng 2 socket của cuộc gọi, để không ai chèn SDP vào call của người khác.
  socket.on("call:signal", (payload: any) => {
    const call = calls.get(payload?.callId);
    if (!call || !call.calleeSocketId || typeof payload?.data !== "object") return;

    const target =
      socket.id === call.callerSocketId
        ? call.calleeSocketId
        : socket.id === call.calleeSocketId
          ? call.callerSocketId
          : null;
    if (target) io.to(target).emit("call:signal", { callId: call.id, data: payload.data });
  });

  socket.on("disconnect", () => {
    const call = calls.get(userCalls.get(userId) ?? "");
    if (call && (socket.id === call.callerSocketId || socket.id === call.calleeSocketId)) {
      endCall(io, call, "disconnected");
    }
  });
};
