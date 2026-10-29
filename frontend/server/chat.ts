import type { ChatThemeId } from "@/lib/chat-themes";
import {
  Conversation,
  ConversationResponse,
  FileMeta,
  Message,
  Reaction,
} from "@/types/ConversationType";

/** Đính kèm tùy chọn đi kèm tin nhắn chat. */
export interface MessageAttachments {
  imgUrl?: string;
  audioUrl?: string;
  fileUrl?: string;
  fileMeta?: FileMeta;
  stickerUrl?: string;
}
import { api } from "./api";

interface FetchMessageProps {
  messages: Message[];
  cursor?: string;
}

const pageLimit = 50;

export const chatService = {
  async fetchConversations(): Promise<ConversationResponse> {
    const res = await api.get<ConversationResponse>("/conversations");
    return res;
  },

  async fetchMessages(id: string, cursor?: string): Promise<FetchMessageProps> {
    const res = await api.get<{
      messages: Message[];
      nextCursor?: string;
    }>(`/conversations/${id}/messages?limit=${pageLimit}&cursor=${cursor}`);

    return { messages: res.messages, cursor: res.nextCursor };
  },

  async sendDirectMessage(
    recipientId: string,
    content: string = "",
    attachments?: MessageAttachments,
    conversationId?: string
  ) {
    const res = await api.post<Message>("/messages/direct", {
      recipientId,
      content,
      ...attachments,
      conversationId,
    });

    return res;
  },

  async sendGroupMessage(
    conversationId: string,
    content: string = "",
    attachments?: MessageAttachments
  ) {
    const res = await api.post<Message>("/messages/group", {
      conversationId,
      content,
      ...attachments,
    });
    return res;
  },

  async markAsSeen(conversationId: string) {
    const res = await api.patch<any>(`/conversations/${conversationId}/seen`);
    return res;
  },

  async createConversation(
    type: "direct" | "group",
    name: string | undefined,
    memberIds: string[]
  ) {
    // Backend trả về { conversation: {...} } — bóc ra cho store.
    const res = await api.post<{ conversation: Conversation }>("/conversations", {
      type,
      name: name && name.trim() ? name : undefined,
      memberIds,
    });
    return res.conversation;
  },

  /** Rời group chat; response là conversation đã đóng băng tại leftAt. */
  async leaveGroup(conversationId: string): Promise<Conversation> {
    const res = await api.post<{ conversation: Conversation }>(
      `/conversations/${conversationId}/leave`
    );
    return res.conversation;
  },

  async updateSettings(
    conversationId: string,
    settings: { theme?: ChatThemeId; quickEmoji?: string }
  ) {
    return api.patch<{ conversationId: string; theme: ChatThemeId; quickEmoji: string }>(
      `/conversations/${conversationId}/settings`,
      settings
    );
  },

  async toggleReaction(messageId: string, emoji: string) {
    return api.put<{ conversationId: string; messageId: string; reactions: Reaction[] }>(
      `/messages/${messageId}/reaction`,
      { emoji }
    );
  },

  /** Sửa tin nhắn text của mình (backend cho phép trong vòng 15 phút). */
  async editMessage(messageId: string, content: string) {
    const res = await api.patch<{ message: Message }>(`/messages/${messageId}`, { content });
    return res.message;
  },

  /** Thu hồi tin nhắn của mình với mọi người; file đính kèm cũng bị xóa. */
  async recallMessage(messageId: string) {
    const res = await api.delete<{ message: Message }>(`/messages/${messageId}`);
    return res.message;
  },

  /** Xóa group chat (chỉ người tạo). */
  async deleteGroup(conversationId: string) {
    return api.delete<{ message: string }>(`/conversations/${conversationId}`);
  },
};