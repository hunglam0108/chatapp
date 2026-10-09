"use client";

import { useCallback } from "react";
import { chatStore } from "@/store/chatStore";
import { socketStore } from "@/store/socketStore";
import { authStore } from "@/store/authStore";
import type { Conversation } from "@/types/ConversationType";

/** Live list of online user ids from the socket store. */
export function useOnlineUsers(): string[] {
  return socketStore((s) => s.onlineUsers);
}

export interface ConversationMeta {
  conversation: Conversation;
  /** Chat header title: group name or the other participant's display name. */
  title: string;
  /** For direct chats: the other participant (null for group chats). */
  otherParticipant: Conversation["participants"][number] | null;
  /** True when the other direct participant is currently online. */
  isOnline: boolean;
  /** True when I am still an active participant of this conversation. */
  isMember: boolean;
  /** For group chats: true when I created the group (can delete it). */
  isCreator: boolean;
}

/** Conversation view-model helpers used by both sidebar and chat panel. */
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

/** Send a message to the active conversation (direct or group). */
export function useSendMessage() {
  const activeConversationId = chatStore((s) => s.activeConversationId);
  const conversations = chatStore((s) => s.conversations);
  const currentUserId = authStore((s) => s.user?._id);

  return useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || !activeConversationId) return;

      const conversation = conversations.find(
        (c) => c._id === activeConversationId
      );
      if (!conversation) return;

      if (conversation.type === "group") {
        // Members who left the group keep old history but can't send.
        const isMember = conversation.participants.some(
          (p) => p._id === currentUserId
        );
        if (!isMember) return;

        await chatStore
          .getState()
          .sendGroupMessage(activeConversationId, trimmed);
        return;
      }

      const recipient = conversation.participants.find(
        (p) => p._id !== currentUserId
      );
      if (!recipient) return;

      await chatStore.getState().sendDirectMessage(recipient._id, trimmed);
    },
    [activeConversationId, conversations, currentUserId]
  );
}
