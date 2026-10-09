import { Conversation, ConversationResponse, Message } from "@/types/ConversationType";
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
    imgUrl?: string,
    conversationId?: string
  ) {
    const res = await api.post<Message>("/messages/direct", {
      recipientId,
      content,
      imgUrl,
      conversationId,
    });

    return res;
  },

  async sendGroupMessage(
    conversationId: string,
    content: string = "",
    imgUrl?: string
  ) {
    const res = await api.post<Message>("/messages/group", {
      conversationId,
      content,
      imgUrl,
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
    // Backend answers { conversation: {...} } — unwrap it for the store.
    const res = await api.post<{ conversation: Conversation }>("/conversations", {
      type,
      name: name && name.trim() ? name : undefined,
      memberIds,
    });
    return res.conversation;
  },

  /** Leave a group chat; the response is the conversation frozen at leftAt. */
  async leaveGroup(conversationId: string): Promise<Conversation> {
    const res = await api.post<{ conversation: Conversation }>(
      `/conversations/${conversationId}/leave`
    );
    return res.conversation;
  },

  /** Delete a group chat (creator only). */
  async deleteGroup(conversationId: string) {
    return api.delete<{ message: string }>(`/conversations/${conversationId}`);
  },
};