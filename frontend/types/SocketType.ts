import type { Socket } from "socket.io-client";
import { Conversation, CustomEmoji, Message, Reaction } from "./ConversationType";
import type { ChatThemeId } from "@/lib/chat-themes";
import { Friend, FriendRequest, SearchUser } from "./UserType";
import type { MessageAttachments } from "@/server/chat";


export interface AuthState {
  accessToken: string | null;
  user: User | null;
  loading: boolean;

  setAccessToken: (accessToken: string) => void;
  setUser: (user: User) => void;
  clearState: () => void;
  signUp: (
    username: string,
    password: string,
    email: string,
    firstName: string,
    lastName: string
  ) => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchMe: () => Promise<void>;
  refresh: () => Promise<void>;
}

export interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (dark: boolean) => void;
}

export interface ChatState {
  conversations: Conversation[];
  messages: Record<
    string,
    {
      items: Message[];
      hasMore: boolean; // infinite-scroll
      nextCursor?: string | null; // phân trang
    }
  >;
  activeConversationId: string | null;
  convoLoading: boolean;
  messageLoading: boolean;
  loading: boolean;
  reset: () => void;

  setActiveConversation: (id: string | null) => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId?: string) => Promise<void>;
  sendDirectMessage: (
    recipientId: string,
    content: string,
    attachments?: MessageAttachments
  ) => Promise<void>;
  sendGroupMessage: (
    conversationId: string,
    content: string,
    attachments?: MessageAttachments
  ) => Promise<void>;
  /** Thêm các tin nhắn do socket đẩy về trong một lần cập nhật store (gom batch). */
  addMessages: (messages: Message[]) => void;
  // cập nhật convo
  updateConversation: (conversation: unknown) => void;
  /** Bỏ conversation ở local (dùng khi nhóm bị xóa). */
  removeConversation: (conversationId: string) => void;
  markAsSeen: () => Promise<void>;
  addConvo: (convo: Conversation) => void;
  createConversation: (
    type: "group" | "direct",
    name: string,
    memberIds: string[]
  ) => Promise<void>;
  /** Đổi theme / quick emoji dùng chung của conversation. */
  updateConversationSettings: (
    conversationId: string,
    settings: { theme?: ChatThemeId; quickEmoji?: string }
  ) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  /** Áp dụng danh sách reaction do server đẩy về (socket event đã gom batch). */
  applyReactions: (
    updates: { conversationId: string; messageId: string; reactions: Reaction[] }[]
  ) => void;
  editMessage: (messageId: string, content: string) => Promise<void>;
  recallMessage: (messageId: string) => Promise<void>;
  /** Thay tin nhắn đã sửa/thu hồi (từ API hoặc socket). */
  applyMessageUpdate: (message: Message) => void;
  /** Rời group chat; lịch sử cũ vẫn xem được, không nhận tin nhắn mới. */
  leaveGroup: (conversationId: string) => Promise<void>;
  /** Xóa group chat (chỉ người tạo). */
  deleteGroup: (conversationId: string) => Promise<void>;
}

export interface SocketState {
  socket: Socket | null;
  onlineUsers: string[];
  connectSocket: () => void;
  disconnectSocket: () => void;
}

export interface FriendState {
  friends: Friend[];
  loading: boolean;
  receivedList: FriendRequest[];
  sentList: FriendRequest[];
  searchResults: SearchUser[] | null;
  searchLoading: boolean;
  searchUsers: (query: string) => Promise<void>;
  clearSearch: () => void;
  addFriend: (to: string, message?: string) => Promise<string>;
  getAllFriendRequests: () => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  getFriends: () => Promise<void>;
  /** Gọi từ socket handler khi có người gửi lời mời cho mình */
  receiveFriendRequest: (request: FriendRequest) => void;
  /** Gọi từ socket handler khi lời mời mình gửi được chấp nhận/bị từ chối */
  removeSentRequest: (requestId: string) => void;
  /** Gọi từ socket handler sau khi mình chấp nhận: thêm bạn mới */
  addFriendFromRequest: (friend: Friend) => void;
  resetFriends: () => void;
}

export interface EmojiState {
  emojis: CustomEmoji[];
  loading: boolean;
  fetchEmojis: () => Promise<void>;
  createEmoji: (file: File, name: string) => Promise<void>;
  deleteEmoji: (emojiId: string) => Promise<void>;
  reset: () => void;
}

export interface UserState {
}
export interface ChatbotState {
  open: boolean;
  mascotId: string;
  setOpen: (open: boolean) => void;
  setMascotId: (mascotId: string) => void;
}
