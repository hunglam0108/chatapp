import type { CSSProperties } from "react";

// Giữ id đồng bộ với CHAT_THEME_IDS trong backend/src/models/Conversation.ts.
// background: gradient màu + ảnh minh hoạ SVG trong public/chat-themes (hiển thị với size cover).
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
      "linear-gradient(160deg, oklch(0.7 0.12 230 / 0.2), oklch(0.78 0.1 195 / 0.08)), url(/chat-themes/ocean.svg)",
  },
  {
    id: "sunset",
    label: "Sunset",
    bubble: "oklch(0.66 0.19 40)",
    bubbleForeground: "oklch(1 0 0)",
    background:
      "linear-gradient(160deg, oklch(0.75 0.15 50 / 0.2), oklch(0.7 0.17 350 / 0.1)), url(/chat-themes/sunset.svg)",
  },
  {
    id: "forest",
    label: "Forest",
    bubble: "oklch(0.55 0.13 155)",
    bubbleForeground: "oklch(1 0 0)",
    background:
      "linear-gradient(160deg, oklch(0.72 0.12 150 / 0.18), oklch(0.8 0.1 120 / 0.08)), url(/chat-themes/forest.svg)",
  },
  {
    id: "rose",
    label: "Rose",
    bubble: "oklch(0.62 0.2 0)",
    bubbleForeground: "oklch(1 0 0)",
    background:
      "linear-gradient(160deg, oklch(0.75 0.14 0 / 0.18), oklch(0.8 0.1 320 / 0.08)), url(/chat-themes/rose.svg)",
  },
  {
    id: "midnight",
    label: "Midnight",
    bubble: "oklch(0.4 0.12 275)",
    bubbleForeground: "oklch(1 0 0)",
    background:
      "linear-gradient(160deg, oklch(0.35 0.1 270 / 0.25), oklch(0.45 0.12 300 / 0.12)), url(/chat-themes/midnight.svg)",
  },
] as const;

/** Theme Custom: ảnh nền + màu bubble riêng của conversation (backgroundUrl, bubbleColor). */
export const CUSTOM_THEME_ID = "custom";

export type ChatThemeId = (typeof CHAT_THEMES)[number]["id"] | typeof CUSTOM_THEME_ID;

export const DEFAULT_QUICK_EMOJI = "👍";

export function getChatTheme(id?: string) {
  return CHAT_THEMES.find((t) => t.id === id) ?? CHAT_THEMES[0];
}

/** Nền theme Custom: ảnh của user dưới một lớp phủ mờ theo màu nền để chữ dễ đọc. */
export function customBackground(url: string) {
  const scrim = "color-mix(in oklch, var(--background) 30%, transparent)";
  return `linear-gradient(${scrim}, ${scrim}), url("${encodeURI(url)}")`;
}

/** Màu bubble gợi ý cho theme Custom (hex vì backend chỉ nhận #rrggbb). */
export const CUSTOM_BUBBLE_COLORS = [
  "#0ea5e9", "#f97316", "#16a34a", "#e11d48", "#db2777", "#4338ca", "#111827",
];

/** Chữ trắng hoặc đen tùy độ sáng của màu bubble (#rrggbb). */
export function readableForeground(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? "oklch(0.2 0 0)" : "oklch(1 0 0)";
}

/**
 * Các CSS variable mà chat panel sử dụng (bubble + nền vùng tin nhắn).
 * Theme Custom: ảnh của user + màu bubble user chọn (mặc định Default).
 */
export function chatThemeStyle(
  id?: string,
  backgroundUrl?: string | null,
  bubbleColor?: string | null
): CSSProperties {
  const isCustom = id === CUSTOM_THEME_ID && !!backgroundUrl;
  const theme = isCustom ? CHAT_THEMES[0] : getChatTheme(id);
  const customBubble = isCustom && bubbleColor ? bubbleColor : null;
  return {
    "--chat-bubble": customBubble ?? theme.bubble,
    "--chat-bubble-foreground": customBubble
      ? readableForeground(customBubble)
      : theme.bubbleForeground,
    "--chat-background": isCustom ? customBackground(backgroundUrl) : theme.background,
  } as CSSProperties;
}

// Một emoji = pictograph + skin tone / VS16 tùy chọn, nối bằng ZWJ (👨‍👩‍👧).
const EMOJI = String.raw`\p{Extended_Pictographic}[\p{Emoji_Modifier}️]*(?:‍\p{Extended_Pictographic}[\p{Emoji_Modifier}️]*)*`;
const EMOJI_ONLY = new RegExp(`^(?:${EMOJI}\\s*){1,3}$`, "u");

/** Kiểu Messenger: tối đa 3 emoji và không có gì khác thì hiển thị lớn, không có bubble. */
export function isEmojiOnly(text?: string | null) {
  return !!text && EMOJI_ONLY.test(text.trim());
}
