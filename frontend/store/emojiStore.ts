import { create } from "zustand";
import type { EmojiState } from "@/types/SocketType";
import { emojiService } from "@/server/emoji";
import { uploadFile } from "@/server/upload";
import { resizeImageToSquare } from "@/lib/image";

export const emojiStore = create<EmojiState>()((set) => ({
  emojis: [],
  loading: false,

  fetchEmojis: async () => {
    set({ loading: true });
    try {
      const emojis = await emojiService.fetchEmojis();
      set({ emojis });
    } catch (error) {
      console.error("Error loading emojis:", error);
    } finally {
      set({ loading: false });
    }
  },

  createEmoji: async (file, name) => {
    const image = await resizeImageToSquare(file);
    const { url } = await uploadFile(image);
    const emoji = await emojiService.createEmoji(name, url);
    set((state) => ({ emojis: [...state.emojis, emoji] }));
  },

  deleteEmoji: async (emojiId) => {
    await emojiService.deleteEmoji(emojiId);
    set((state) => ({ emojis: state.emojis.filter((e) => e._id !== emojiId) }));
  },

  reset: () => set({ emojis: [], loading: false }),
}));
