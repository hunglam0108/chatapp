import { api } from "./api";

export interface ChatbotMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatbotClientSettings {
  darkMode: boolean;
  mascot: string;
}

export const chatbotService = {
  async ask(messages: ChatbotMessage[], clientSettings: ChatbotClientSettings) {
    const res = await api.post<{ reply: string }>("/chatbot", { messages, clientSettings });
    return res.reply;
  },
};
