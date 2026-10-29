import { create } from "zustand";
import type { ChatbotState } from "@/types/SocketType";

export const chatbotStore = create<ChatbotState>()((set) => ({
  open: false,
  mascotId: "cat",
  setOpen: (open) => set({ open }),
  setMascotId: (mascotId) => set({ mascotId }),
}));
