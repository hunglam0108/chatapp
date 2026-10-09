import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
import { authStore } from "./authStore";
import { chatStore } from "./chatStore";
import { friendStore } from "./friendStore";
import { SocketState } from "@/types/SocketType";
import type { Conversation, Message, SeenUser } from "@/types/ConversationType";
import type { Friend } from "@/types/UserType";
import { toast } from "sonner";

const baseURL = process.env.NEXT_PUBLIC_SOCKET_URL;

export const socketStore = create<SocketState>((set, get) => ({
  socket: null,
  onlineUsers: [],
  connectSocket: () => {
    const accessToken = authStore.getState().accessToken;
    const existingSocket = get().socket;

    if (existingSocket) return; // tránh tạo nhiều socket

    const socket: Socket = io(baseURL, {
      auth: { token: accessToken },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    set({ socket });

    socket.on("connect", () => {
      console.log("Đã kết nối với socket");
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket ngắt kết nối:", reason);
    });

    // online users — dùng cho badge trạng thái on/off trong sidebar & chat header
    socket.on("online-users", (userIds: string[]) => {
      set({ onlineUsers: userIds });
    });

    // new message
    socket.on(
      "new-message",
      ({
        message,
        conversation,
        unreadCounts,
      }: {
        message: Message;
        conversation: {
          _id: string;
          lastMessage: {
            _id: string;
            content: string;
            senderId: string;
            createdAt: string;
          };
          lastMessageAt: string;
        };
        unreadCounts: Record<string, number>;
      }) => {
        chatStore.getState().addMessage(message);

        const lastMessage = {
          _id: conversation.lastMessage._id,
          content: conversation.lastMessage.content,
          createdAt: conversation.lastMessage.createdAt,
          sender: {
            _id: conversation.lastMessage.senderId,
            displayName: "",
            avatarUrl: null,
          },
        };

        const updatedConversation = {
          ...conversation,
          lastMessage,
          unreadCounts,
        };

        if (
          chatStore.getState().activeConversationId === message.conversationId
        ) {
          chatStore.getState().markAsSeen();
        }

        chatStore.getState().updateConversation(updatedConversation);
      }
    );

    // read message
    socket.on(
      "read-message",
      ({
        conversation,
        lastMessage,
      }: {
        conversation: {
          _id: string;
          lastMessageAt: string;
          unreadCounts: Record<string, number>;
          seenBy: SeenUser[];
        };
        lastMessage: {
          _id: string;
          content: string;
          createdAt: string;
          sender: { _id: string };
        };
      }) => {
        const updated = {
          _id: conversation._id,
          lastMessage,
          lastMessageAt: conversation.lastMessageAt,
          unreadCounts: conversation.unreadCounts,
          seenBy: conversation.seenBy,
        };

        chatStore.getState().updateConversation(updated);
      }
    );

    // new group chat
    socket.on("new-group", (conversation) => {
      chatStore.getState().addConvo(conversation);
      socket.emit("join-conversation", conversation._id);
    });

    // A group we are in was deleted by its creator — drop it everywhere.
    socket.on("group-deleted", ({ conversationId }: { conversationId: string }) => {
      const existed = chatStore
        .getState()
        .conversations.some((c) => c._id === conversationId);
      chatStore.getState().removeConversation(conversationId);
      if (existed) {
        toast.info("Nhóm chat đã bị xóa");
      }
    });

    // Another member left a group we are in — refresh its member list.
    socket.on(
      "group-member-left",
      ({ userId, conversation }: { userId: string; conversation: Conversation }) => {
        const me = authStore.getState().user?._id;
        if (userId === me) return; // our own leave arrives via "group-left"
        chatStore.getState().updateConversation(conversation);
      }
    );

    // We (one of our sessions) left a group — freeze the chat at leftAt.
    socket.on("group-left", ({ conversation }: { conversation: Conversation }) => {
      chatStore.getState().updateConversation(conversation);
      toast.info("Bạn đã rời khỏi nhóm");
    });

    // ===== Friend requests (real-time) =====

    // Ai đó gửi cho mình lời mời kết bạn
    socket.on("friend-request:receive", (request) => {
      friendStore.getState().receiveFriendRequest(request);
    });

    // Người nhận đã chấp nhận lời mời mình gửi
    socket.on(
      "friend-request:accepted",
      ({ requestId, newFriend }: { requestId: string; newFriend: Friend }) => {
        friendStore.getState().removeSentRequest(requestId);
        friendStore.getState().addFriendFromRequest(newFriend);
      }
    );

    // Người nhận đã từ chối lời mời mình gửi
    socket.on(
      "friend-request:declined",
      ({ requestId }: { requestId: string }) => {
        friendStore.getState().removeSentRequest(requestId);
      }
    );
  },
  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },
}));
