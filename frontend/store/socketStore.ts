import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
import { authStore } from "./authStore";
import { chatStore } from "./chatStore";
import { friendStore } from "./friendStore";
import { callStore } from "./callStore";
import type {
  CallEndedPayload,
  CallIncomingPayload,
  CallSignalPayload,
  SocketState,
} from "@/types/SocketType";
import type { Conversation, Message, Reaction, SeenUser } from "@/types/ConversationType";
import type { Friend } from "@/types/UserType";
import { toast } from "sonner";

const baseURL = process.env.NEXT_PUBLIC_SOCKET_URL;

// Event "new-message"/"read-message" có thể tới dồn dập: gom lại trong một
// khoảng ngắn rồi cập nhật store một lần, thay vì re-render + gọi API mỗi event.
const FLUSH_DELAY_MS = 50;

type ConversationPatch = { _id: string } & Record<string, unknown>;

type ReactionUpdate = { conversationId: string; messageId: string; reactions: Reaction[] };

let pendingMessages: Message[] = [];
let pendingConversations = new Map<string, ConversationPatch>();
let pendingReactions = new Map<string, ReactionUpdate>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const flushPending = () => {
  flushTimer = null;
  const messages = pendingMessages;
  const conversations = pendingConversations;
  const reactions = pendingReactions;
  pendingMessages = [];
  pendingConversations = new Map();
  pendingReactions = new Map();

  const chat = chatStore.getState();
  if (messages.length > 0) chat.addMessages(messages);
  // Chạy sau addMessages để reaction trên tin nhắn vừa tới vẫn được áp dụng.
  if (reactions.size > 0) chat.applyReactions([...reactions.values()]);
  conversations.forEach((patch) => chat.updateConversation(patch));

  // Gọi sau updateConversation để markAsSeen đọc được unreadCounts mới nhất.
  const { activeConversationId } = chatStore.getState();
  if (messages.some((m) => m.conversationId === activeConversationId)) {
    chat.markAsSeen();
  }
};

const scheduleFlush = () => {
  flushTimer ??= setTimeout(flushPending, FLUSH_DELAY_MS);
};

const clearPending = () => {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  pendingMessages = [];
  pendingConversations = new Map();
  pendingReactions = new Map();
};

const queueConversationPatch = (patch: ConversationPatch) => {
  // Patch tới sau ghi đè field của patch trước cho cùng một convo.
  pendingConversations.set(patch._id, {
    ...pendingConversations.get(patch._id),
    ...patch,
  });
  scheduleFlush();
};

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
      console.log("Connected to socket");
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      // Server kết thúc call khi socket rớt, nên client cũng phải dọn call hiện tại.
      callStore.getState().handleDisconnect();
    });

    // user online — dùng cho badge trạng thái on/off trong sidebar & chat header
    socket.on("online-users", (userIds: string[]) => {
      set({ onlineUsers: userIds });
    });

    // tin nhắn mới
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
        pendingMessages.push(message);

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

        queueConversationPatch({
          ...conversation,
          lastMessage,
          unreadCounts,
        });
      }
    );

    // tin nhắn đã đọc
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

        queueConversationPatch(updated);
      }
    );

    // Theme / quick emoji của conversation đã đổi (bởi bất kỳ thành viên nào).
    socket.on(
      "conversation-settings-updated",
      ({
        conversationId,
        theme,
        quickEmoji,
      }: {
        conversationId: string;
        theme: string;
        quickEmoji: string;
      }) => {
        queueConversationPatch({ _id: conversationId, theme, quickEmoji });
      }
    );

    // Reaction của tin nhắn đã đổi — chỉ cần danh sách mới nhất của mỗi tin nhắn.
    socket.on("message-reaction", (update: ReactionUpdate) => {
      pendingReactions.set(update.messageId, update);
      scheduleFlush();
    });

    // Một tin nhắn đã được sửa hoặc thu hồi.
    socket.on(
      "message-updated",
      ({
        message,
        lastMessage,
      }: {
        message: Message;
        lastMessage?: { content: string | null; recalled: boolean };
      }) => {
        chatStore.getState().applyMessageUpdate(message);
        if (!lastMessage) return;

        const current = chatStore
          .getState()
          .conversations.find((c) => c._id === message.conversationId)?.lastMessage;
        if (!current) return;
        queueConversationPatch({
          _id: message.conversationId,
          lastMessage: { ...current, content: lastMessage.content, recalled: lastMessage.recalled },
        });
      }
    );

    // group chat mới
    socket.on("new-group", (conversation) => {
      chatStore.getState().addConvo(conversation);
      socket.emit("join-conversation", conversation._id);
    });

    // Nhóm mình đang tham gia bị người tạo xóa — bỏ nó ở mọi nơi.
    socket.on("group-deleted", ({ conversationId }: { conversationId: string }) => {
      const existed = chatStore
        .getState()
        .conversations.some((c) => c._id === conversationId);
      chatStore.getState().removeConversation(conversationId);
      if (existed) {
        toast.info("The group chat was deleted");
      }
    });

    // Một thành viên khác rời nhóm mình đang ở — làm mới danh sách thành viên.
    socket.on(
      "group-member-left",
      ({ userId, conversation }: { userId: string; conversation: Conversation }) => {
        const me = authStore.getState().user?._id;
        if (userId === me) return; // việc mình rời nhóm sẽ tới qua "group-left"
        chatStore.getState().updateConversation(conversation);
      }
    );

    // Mình (một trong các session) đã rời nhóm — đóng băng chat tại leftAt.
    socket.on("group-left", ({ conversation }: { conversation: Conversation }) => {
      chatStore.getState().updateConversation(conversation);
      toast.info("You left the group");
    });

    // ===== Call 1-1 (WebRTC signaling) =====
    socket.on("call:incoming", (payload: CallIncomingPayload) => {
      callStore.getState().handleIncoming(payload);
    });
    socket.on("call:accepted", (payload: { callId: string }) => {
      void callStore.getState().handleAccepted(payload);
    });
    socket.on("call:signal", (payload: CallSignalPayload) => {
      callStore.getState().handleSignal(payload);
    });
    socket.on("call:ended", (payload: CallEndedPayload) => {
      callStore.getState().handleEnded(payload);
    });

    // ===== Lời mời kết bạn (real-time) =====

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
    clearPending();
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },
}));
