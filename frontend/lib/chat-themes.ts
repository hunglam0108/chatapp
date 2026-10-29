import type { CSSProperties } from "react";

// Giữ id đồng bộ với CHAT_THEME_IDS trong backend/src/models/Conversation.ts.
export const CHAT_THEMES = [
  {
    id: "default",
    label: "Default",
    bubble: "var(--chat-bubble-default)",
    bubbleForeground: "var(--primary-foreground)",
    background: "none",
  },
  {
    id: "ocean",
    label: "Ocean",
    bubble: "oklch(0.58 0.15 240)",
    bubbleForeground: "oklch(1 0 0)",
    background:
      "linear-gradient(160deg, oklch(0.7 0.12 230 / 0.2), oklch(0.78 0.1 195 / 0.08))",
  },
  {
    id: "sunset",
    label: "Sunset",
    bubble: "oklch(0.66 0.19 40)",
    bubbleForeground: "oklch(1 0 0)",
    background:
      "linear-gradient(160deg, oklch(0.75 0.15 50 / 0.2), oklch(0.7 0.17 350 / 0.1))",
  },
  {
    id: "forest",
    label: "Forest",
    bubble: "oklch(0.55 0.13 155)",
    bubbleForeground: "oklch(1 0 0)",
    background:
      "linear-gradient(160deg, oklch(0.72 0.12 150 / 0.18), oklch(0.8 0.1 120 / 0.08))",
  },
  {
    id: "rose",
    label: "Rose",
    bubble: "oklch(0.62 0.2 0)",
    bubbleForeground: "oklch(1 0 0)",
    background:
      "linear-gradient(160deg, oklch(0.75 0.14 0 / 0.18), oklch(0.8 0.1 320 / 0.08))",
  },
  {
    id: "midnight",
    label: "Midnight",
    bubble: "oklch(0.4 0.12 275)",
    bubbleForeground: "oklch(1 0 0)",
    background:
      "linear-gradient(160deg, oklch(0.35 0.1 270 / 0.25), oklch(0.45 0.12 300 / 0.12))",
  },
] as const;

export type ChatThemeId = (typeof CHAT_THEMES)[number]["id"];

export const DEFAULT_QUICK_EMOJI = "👍";

export function getChatTheme(id?: string) {
  return CHAT_THEMES.find((t) => t.id === id) ?? CHAT_THEMES[0];
}

/** Các CSS variable mà chat panel sử dụng (bubble + nền vùng tin nhắn). */
export function chatThemeStyle(id?: string): CSSProperties {
  const theme = getChatTheme(id);
  return {
    "--chat-bubble": theme.bubble,
    "--chat-bubble-foreground": theme.bubbleForeground,
    "--chat-background": theme.background,
  } as CSSProperties;
}

// Một emoji = pictograph + skin tone / VS16 tùy chọn, nối bằng ZWJ (👨‍👩‍👧).
const EMOJI = String.raw`\p{Extended_Pictographic}[\p{Emoji_Modifier}️]*(?:‍\p{Extended_Pictographic}[\p{Emoji_Modifier}️]*)*`;
const EMOJI_ONLY = new RegExp(`^(?:${EMOJI}\\s*){1,3}$`, "u");

/** Kiểu Messenger: tối đa 3 emoji và không có gì khác thì hiển thị lớn, không có bubble. */
export function isEmojiOnly(text?: string | null) {
  return !!text && EMOJI_ONLY.test(text.trim());
}
