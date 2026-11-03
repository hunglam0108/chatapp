import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authStore } from "./authStore";
import type { Conversation, Message } from "@/types/ConversationType";
import { ChatState } from "@/types/SocketType";
import { chatService, type MessageAttachments } from "@/server/chat";
import { socketStore } from "./socketStore";

const updateItems = (conversationId: string, fn: (items: Message[]) => Message[]) =>
  chatStore.setState((state) => {
    const bucket = state.messages[conversationId];
    if (!bucket) return state;
    return {
      messages: { ...state.messages, [conversationId]: { ...bucket, items: fn(bucket.items) } },
    };
  });

const MATCH_KEYS = ["content", "imgUrl", "audioUrl", "fileUrl", "stickerUrl"] as const;
/** Tin thật (từ socket) có khớp với tin optimistic đang chờ không. */
const matchesPending = (pending: Message, real: Message) =>
  MATCH_KEYS.every((k) => (pending[k] || null) === (real[k] || null));

/** Hiện tin nhắn ngay, thay bằng tin thật khi API trả về, gỡ đi nếu lỗi. */
const sendOptimistic = async (
  conversationId: string | null,
  content: string,
  attachments: MessageAttachments | undefined,
  request: () => Promise<Message>
) => {
  const user = authStore.getState().user;
  const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (conversationId && user) {
    updateItems(conversationId, (items) => [
      ...items,
      {
        _id: tempId,
        conversationId,
        senderId: user._id,
        content,
        ...attachments,
        createdAt: new Date().toISOString(),
        isOwn: true,
        pending: true,
      },
    ]);
  }

  try {
    const real = await request();
    if (!conversationId) return;
    updateItems(conversationId, (items) =>
      // Socket có thể đã đẩy tin thật về trước response.
      items.some((m) => m._id === real._id)
        ? items.filter((m) => m._id !== tempId)
        : items.map((m) => (m._id === tempId ? { ...real, isOwn: true } : m))
    );
  } catch (error) {
    if (conversationId) updateItems(conversationId, (items) => items.filter((m) => m._id !== tempId));
    throw error;
  }
};

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
        const { activeConversationId } = get();
        await sendOptimistic(activeConversationId, content, attachments, () =>
          chatService.sendDirectMessage(
            recipientId,
            content,
            attachments,
            activeConversationId || undefined
          )
        );
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c._id === activeConversationId ? { ...c, seenBy: [] } : c
          ),
        }));
      },
      sendGroupMessage: async (
        conversationId: string,
        content: string,
        attachments?: MessageAttachments
      ) => {
        await sendOptimistic(conversationId, content, attachments, () =>
          chatService.sendGroupMessage(conversationId, content, attachments)
        );
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c._id === conversationId ? { ...c, seenBy: [] } : c
          ),
        }));
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

            const isOwn = message.senderId === user?._id;
            const real = { ...message, isOwn };
            // Tin của mình về qua socket trước response API: thay tin optimistic, không thêm trùng.
            const pendingIndex = isOwn
              ? bucket.items.findIndex((m) => m.pending && matchesPending(m, message))
              : -1;

            messages[message.conversationId] = {
              ...bucket,
              items:
                pendingIndex >= 0
                  ? bucket.items.map((m, i) => (i === pendingIndex ? real : m))
                  : [...bucket.items, real],
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
        const { theme, quickEmoji, backgroundUrl, bubbleColor } =
          await chatService.updateSettings(conversationId, settings);
        get().updateConversation({
          _id: conversationId,
          theme,
          quickEmoji,
          backgroundUrl,
          bubbleColor,
        });
      },
      toggleReaction: async (messageId, emoji) => {
        const userId = authStore.getState().user?._id;
        const { messages } = get();
        const conversationId = Object.keys(messages).find((id) =>
          messages[id].items.some((m) => m._id === messageId)
        );
        const previous =
          (conversationId &&
            messages[conversationId].items.find((m) => m._id === messageId)?.reactions) ||
          [];

        // Cùng logic với backend: bấm lại emoji của mình thì bỏ, emoji khác thì thay.
        if (conversationId && userId) {
          const mine = previous.find((r) => r.userId === userId);
          const others = previous.filter((r) => r.userId !== userId);
          get().applyReactions([
            {
              conversationId,
              messageId,
              reactions: mine?.emoji === emoji ? others : [...others, { userId, emoji }],
            },
          ]);
        }

        try {
          get().applyReactions([await chatService.toggleReaction(messageId, emoji)]);
        } catch (error) {
          if (conversationId) {
            get().applyReactions([{ conversationId, messageId, reactions: previous }]);
          }
          throw error;
        }
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