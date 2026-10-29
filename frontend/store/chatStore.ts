import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authStore } from "./authStore";
import type { Conversation, Message } from "@/types/ConversationType";
import { ChatState } from "@/types/SocketType";
import { chatService, type MessageAttachments } from "@/server/chat";
import { socketStore } from "./socketStore";

export const chatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [] as Conversation[],
      messages: {},
      activeConversationId: null,
      convoLoading: false, // đang load convo
      messageLoading: false,
      loading: false,

      setActiveConversation: (id) => set({ activeConversationId: id }),
      reset: () => {
        set({
          conversations: [],
          messages: {},
          activeConversationId: null,
          convoLoading: false,
          messageLoading: false,
        });
      },
      fetchConversations: async () => {
        try {
          set({ convoLoading: true });
          const { conversations } = await chatService.fetchConversations();

          set({ conversations, convoLoading: false });
        } catch (error) {
          console.error("Error in fetchConversations:", error);
          set({ convoLoading: false });
        }
      },
      fetchMessages: async (conversationId) => {
        const { activeConversationId, messages } = get();
        const { user } = authStore.getState();

        const convoId = conversationId ?? activeConversationId;

        if (!convoId) return;

        const current = messages?.[convoId];
        const nextCursor =
          current?.nextCursor === undefined ? "" : current?.nextCursor;

        if (nextCursor === null) return;

        set({ messageLoading: true });

        try {
          const { messages: fetched, cursor } = await chatService.fetchMessages(
            convoId,
            nextCursor
          );

          const processed = fetched.map((m) => ({
            ...m,
            isOwn: m.senderId === user?._id,
          }));

          set((state) => {
            const prev = state.messages[convoId]?.items ?? [];
            const merged = prev.length > 0 ? [...processed, ...prev] : processed;

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  items: merged,
                  hasMore: !!cursor,
                  nextCursor: cursor ?? null,
                },
              },
            };
          });
        } catch (error) {
          console.error("Error in fetchMessages:", error);
        } finally {
          set({ messageLoading: false });
        }
      },
      sendDirectMessage: async (
        recipientId: string,
        content: string,
        attachments?: MessageAttachments
      ) => {
        try {
          const { activeConversationId } = get();
          await chatService.sendDirectMessage(
            recipientId,
            content,
            attachments,
            activeConversationId || undefined
          );
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === activeConversationId ? { ...c, seenBy: [] } : c
            ),
          }));
        } catch (error) {
          console.error("Error sending direct message", error);
        }
      },
      sendGroupMessage: async (
        conversationId: string,
        content: string,
        attachments?: MessageAttachments
      ) => {
        try {
          await chatService.sendGroupMessage(conversationId, content, attachments);
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === get().activeConversationId ? { ...c, seenBy: [] } : c
            ),
          }));
        } catch (error) {
          console.error("Error sending group message", error);
        }
      },
      addMessages: (incoming: Message[]) => {
        const { user } = authStore.getState();

        set((state) => {
          const messages = { ...state.messages };
          let changed = false;

          for (const message of incoming) {
            const bucket = messages[message.conversationId];
            // Convo chưa load tin nhắn: bỏ qua, fetchMessages sẽ lấy đủ khi mở convo.
            if (!bucket || bucket.items.some((m) => m._id === message._id)) {
              continue;
            }

            messages[message.conversationId] = {
              ...bucket,
              items: [
                ...bucket.items,
                { ...message, isOwn: message.senderId === user?._id },
              ],
            };
            changed = true;
          }

          return changed ? { messages } : state;
        });
      },
      updateConversation: (conversation: any) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c._id === conversation._id ? { ...c, ...conversation } : c
          ),
        }));
      },
      updateConversationSettings: async (conversationId, settings) => {
        const { theme, quickEmoji } = await chatService.updateSettings(
          conversationId,
          settings
        );
        get().updateConversation({ _id: conversationId, theme, quickEmoji });
      },
      toggleReaction: async (messageId, emoji) => {
        const update = await chatService.toggleReaction(messageId, emoji);
        get().applyReactions([update]);
      },
      applyReactions: (updates) => {
        set((state) => {
          const messages = { ...state.messages };
          let changed = false;

          for (const { conversationId, messageId, reactions } of updates) {
            const bucket = messages[conversationId];
            if (!bucket?.items.some((m) => m._id === messageId)) continue;

            messages[conversationId] = {
              ...bucket,
              items: bucket.items.map((m) =>
                m._id === messageId ? { ...m, reactions } : m
              ),
            };
            changed = true;
          }

          return changed ? { messages } : state;
        });
      },
      editMessage: async (messageId, content) => {
        get().applyMessageUpdate(await chatService.editMessage(messageId, content));
      },
      recallMessage: async (messageId) => {
        get().applyMessageUpdate(await chatService.recallMessage(messageId));
      },
      applyMessageUpdate: (message) => {
        set((state) => {
          const bucket = state.messages[message.conversationId];
          if (!bucket?.items.some((m) => m._id === message._id)) return state;

          return {
            messages: {
              ...state.messages,
              [message.conversationId]: {
                ...bucket,
                // Thay toàn bộ tin nhắn: tin đã thu hồi sẽ mất content/đính kèm.
                items: bucket.items.map((m) =>
                  m._id === message._id ? { ...message, isOwn: m.isOwn } : m
                ),
              },
            },
          };
        });
      },
      removeConversation: (conversationId: string) => {
        set((state) => {
          const messages = { ...state.messages };
          delete messages[conversationId];

          return {
            conversations: state.conversations.filter(
              (c) => c._id !== conversationId
            ),
            messages,
            activeConversationId:
              state.activeConversationId === conversationId
                ? null
                : state.activeConversationId,
          };
        });
      },
      markAsSeen: async () => {
        try {
          const { user } = authStore.getState();
          const { activeConversationId, conversations } = get();

          if (!activeConversationId || !user) {
            return;
          }

          const convo = conversations.find((c) => c._id === activeConversationId);

          if (!convo) {
            return;
          }

          if ((convo.unreadCounts?.[user._id] ?? 0) === 0) {
            return;
          }

          await chatService.markAsSeen(activeConversationId);

          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === activeConversationId && c.lastMessage
                ? {
                    ...c,
                    unreadCounts: {
                      ...c.unreadCounts,
                      [user._id]: 0,
                    },
                  }
                : c
            ),
          }));
        } catch (error) {
          console.error("Error calling markAsSeen in store", error);
        }
      },
      addConvo: (convo) => {
        set((state) => {
          const exists = state.conversations.some(
            (c) => c._id.toString() === convo._id.toString()
          );

          return {
            conversations: exists
              ? state.conversations
              : [convo, ...state.conversations],
            activeConversationId: convo._id,
          };
        });
      },
      createConversation: async (type, name, memberIds) => {
        try {
          set({ loading: true });
          const conversation = await chatService.createConversation(
            type,
            name,
            memberIds
          );

          get().addConvo(conversation);

          socketStore
            .getState()
            .socket?.emit("join-conversation", conversation._id);
        } catch (error) {
          console.error("Error calling createConversation in store", error);
        } finally {
          set({ loading: false });
        }
      },
      leaveGroup: async (conversationId) => {
        try {
          set({ loading: true });
          // Response là conversation đã đóng băng tại thời điểm mình rời:
          // vẫn nằm trong danh sách để xem lịch sử cũ, chỉ không có tin nhắn mới.
          const conversation = await chatService.leaveGroup(conversationId);
          get().updateConversation(conversation);
        } catch (error) {
          console.error("Error leaving group in store", error);
          throw error;
        } finally {
          set({ loading: false });
        }
      },
      deleteGroup: async (conversationId) => {
        try {
          set({ loading: true });
          await chatService.deleteGroup(conversationId);
          get().removeConversation(conversationId);
        } catch (error) {
          console.error("Error deleting group in store", error);
          throw error;
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "chat-storage",
      partialize: (state) => ({ conversations: state.conversations }),
    }
  )
);