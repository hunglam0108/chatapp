import { api } from "./api";
import type { CustomEmoji } from "@/types/ConversationType";

export const emojiService = {
  async fetchEmojis() {
    const res = await api.get<{ emojis: CustomEmoji[] }>("/emojis");
    return res.emojis;
  },

  async createEmoji(name: string, imgUrl: string) {
    const res = await api.post<{ emoji: CustomEmoji }>("/emojis", { name, imgUrl });
    return res.emoji;
  },

  async deleteEmoji(emojiId: string) {
    return api.delete<{ message: string }>(`/emojis/${emojiId}`);
  },
};
