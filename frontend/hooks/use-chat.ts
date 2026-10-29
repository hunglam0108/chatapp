"use client";

import { useCallback } from "react";
import { chatStore } from "@/store/chatStore";
import { socketStore } from "@/store/socketStore";
import { authStore } from "@/store/authStore";
import type { Conversation } from "@/types/ConversationType";
import type { MessageAttachments } from "@/server/chat";

/** Danh sách id user đang online (live) từ socket store. */
export function useOnlineUsers(): string[] {
  return socketStore((s) => s.onlineUsers);
}

export interface ConversationMeta {
  conversation: Conversation;
  /** Tiêu đề header chat: tên nhóm hoặc tên hiển thị của người còn lại. */
  title: string;
  /** Với chat 1-1: người còn lại (null với group chat). */
  otherParticipant: Conversation["participants"][number] | null;
  /** True khi người còn lại trong chat 1-1 đang online. */
  isOnline: boolean;
  /** True khi mình vẫn là thành viên đang hoạt động của conversation này. */
  isMember: boolean;
  /** Với group chat: true khi mình là người tạo nhóm (được xóa nhóm). */
  isCreator: boolean;
}

/** Helper view-model của conversation, dùng chung cho sidebar và chat panel. */
export function useConversationMeta(
  conversationId: string | null
): ConversationMeta | null {
  const conversations = chatStore((s) => s.conversations);
  const onlineUsers = useOnlineUsers();
  const currentUserId = authStore((s) => s.user?._id);

  if (!conversationId) return null;

  const conversation = conversations.find((c) => c._id === conversationId);
  if (!conversation) return null;

  const otherParticipant =
    conversation.type === "direct"
      ? (conversation.participants.find(
          (p) => p._id !== currentUserId
        ) ?? null)
      : null;

  const title =
    conversation.type === "group"
      ? (conversation.group?.name ?? "Group chat")
      : (otherParticipant?.displayName ?? "Direct chat");

  const isOnline =
    conversation.type === "direct" && otherParticipant
      ? onlineUsers.includes(otherParticipant._id)
      : false;

  const isMember = conversation.participants.some(
    (p) => p._id === currentUserId
  );
  const isCreator =
    conversation.type === "group" &&
    !!conversation.group?.createdBy &&
    conversation.group.createdBy === currentUserId;

  return { conversation, title, otherParticipant, isOnline, isMember, isCreator };
}

/** Gửi tin nhắn (text và/hoặc đính kèm) vào conversation đang mở. */
export function useSendMessage() {
  const activeConversationId = chatStore((s) => s.activeConversationId);
  const conversations = chatStore((s) => s.conversations);
  const currentUserId = authStore((s) => s.user?._id);

  return useCallback(
    async (content: string, attachments?: MessageAttachments) => {
      const trimmed = content.trim();
      const hasAttachment = !!attachments && [
        attachments.imgUrl,
        attachments.audioUrl,
        attachments.fileUrl,
        attachments.stickerUrl,
      ].some(Boolean);
      if ((!trimmed && !hasAttachment) || !activeConversationId) return;

      const conversation = conversations.find(
        (c) => c._id === activeConversationId
      );
      if (!conversation) return;

      if (conversation.type === "group") {
        // Thành viên đã rời nhóm vẫn giữ lịch sử cũ nhưng không gửi được.
        const isMember = conversation.participants.some(
          (p) => p._id === currentUserId
        );
        if (!isMember) return;

        await chatStore
          .getState()
          .sendGroupMessage(activeConversationId, trimmed, attachments);
        return;
      }

      const recipient = conversation.participants.find(
        (p) => p._id !== currentUserId
      );
      if (!recipient) return;

      await chatStore
        .getState()
        .sendDirectMessage(recipient._id, trimmed, attachments);
    },
    [activeConversationId, conversations, currentUserId]
  );
}
