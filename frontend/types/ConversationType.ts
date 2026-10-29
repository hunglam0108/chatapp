import type { ChatThemeId } from "@/lib/chat-themes";

export interface Participant {
  _id: string;
  displayName: string;
  avatarUrl?: string | null;
  joinedAt: string;
}

/** Thành viên đã rời nhóm; vẫn đọc được lịch sử tới leftAt. */
export interface FormerMember {
  _id: string;
  displayName: string;
  avatarUrl?: string | null;
  leftAt: string;
}

export interface SeenUser {
  _id: string;
  displayName?: string;
  avatarUrl?: string | null;
}

export interface Group {
  name: string;
  createdBy: string;
}

export interface LastMessage {
  _id: string;
  content: string | null;
  recalled?: boolean;
  createdAt: string;
  sender: {
    _id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  imgUrl?: string | null;
  audioUrl?: string | null;
  fileUrl?: string | null;
  fileMeta?: FileMeta | null;
}

/** Metadata cho file đính kèm thông thường (không phải ảnh, audio). */
export interface FileMeta {
  name: string;
  size: number;
  mimetype: string;
}

export interface ConversationUpdate {
  _id: string;
  type: "direct" | "group";
  group: Group;
  participants: Participant[];
  lastMessageAt: string;
}

export interface Conversation {
  _id: string;
  type: "direct" | "group";
  group: Group;
  participants: Participant[];
  formerMembers?: FormerMember[];
  lastMessageAt: string;
  seenBy: SeenUser[];
  lastMessage: LastMessage | null;
  unreadCounts: Record<string, number>; // key = userId, value = số tin chưa đọc
  theme?: ChatThemeId;
  quickEmoji?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationResponse {
  conversations: Conversation[];
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  imgUrl?: string | null;
  audioUrl?: string | null;
  fileUrl?: string | null;
  fileMeta?: FileMeta | null;
  stickerUrl?: string | null;
  reactions?: Reaction[];
  editedAt?: string | null;
  recalledAt?: string | null;
  updatedAt?: string | null;
  createdAt: string;
  isOwn?: boolean;
}
export interface Reaction {
  userId: string;
  emoji: string;
}

export interface CustomEmoji {
  _id: string;
  name: string;
  imgUrl: string;
}
