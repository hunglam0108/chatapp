"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { EmojiClickData, Theme } from "emoji-picker-react";
import { Loader2Icon } from "lucide-react";
import { themeStore } from "@/store/themeStore";

const LazyEmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] w-[320px] items-center justify-center rounded-2xl border bg-popover shadow-lg">
      <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
    </div>
  ),
});

type PickerProps = ComponentProps<typeof LazyEmojiPicker>;
type PickerCustomEmoji = NonNullable<PickerProps["customEmojis"]>[number];

const MY_EMOJIS_GROUP = "mine";
const CREATE_EMOJI_ID = "__create_emoji__";
const CREATE_EMOJI_TILE: PickerCustomEmoji = {
  id: CREATE_EMOJI_ID,
  names: ["Create emoji from image"],
  group: MY_EMOJIS_GROUP,
  imgUrl: `data:image/svg+xml,${encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='#8b8b9a' stroke-width='1.6' stroke-linecap='round'><rect x='2.5' y='2.5' width='19' height='19' rx='5' stroke-dasharray='3 2.5'/><path d='M12 7.5v9M7.5 12h9'/></svg>"
  )}`,
};

// "My emojis" (bắt đầu bằng ô +) nằm đầu tiên, ngay trên Frequently Used.
// Dùng string thường thay vì enum Categories để thư viện vẫn được lazy-load.
const CATEGORIES_WITH_MY_EMOJIS = [
  { category: "custom", name: "My emojis", group: MY_EMOJIS_GROUP },
  "suggested",
  "smileys_people",
  "animals_nature",
  "food_drink",
  "travel_places",
  "activities",
  "objects",
  "symbols",
  "flags",
] as unknown as PickerProps["categories"];

/**
 * Emoji picker lazy-load, theo theme sáng/tối của app. Khi có
 * `onCreateEmoji`, custom emoji của user có section riêng ở đầu, với
 * ô đầu tiên là "+" để gọi `onCreateEmoji`.
 */
export function EmojiPicker({
  onCreateEmoji,
  customEmojis,
  onEmojiClick,
  ...props
}: PickerProps & { onCreateEmoji?: () => void }) {
  const isDark = themeStore((s) => s.isDark);

  const handleClick = (data: EmojiClickData, event: MouseEvent) => {
    if (data.isCustom && data.unified === CREATE_EMOJI_ID) {
      // shortcut: dựa vào key localStorage nội bộ "epr_suggested" của picker
      // để ô + không lọt vào Frequently Used; xem lại khi nâng major version.
      try {
        const recent = JSON.parse(localStorage.getItem("epr_suggested") ?? "[]");
        localStorage.setItem(
          "epr_suggested",
          JSON.stringify(
            recent.filter((r: { unified?: string }) => r.unified !== CREATE_EMOJI_ID)
          )
        );
      } catch {
        // Storage bị chặn: ô + có thể xuất hiện trong Frequently Used.
      }
      onCreateEmoji?.();
      return;
    }
    onEmojiClick?.(data, event);
  };

  return (
    <LazyEmojiPicker
      theme={(isDark ? "dark" : "light") as Theme}
      previewConfig={{ showPreview: false }}
      {...props}
      {...(onCreateEmoji
        ? {
            categories: CATEGORIES_WITH_MY_EMOJIS,
            customEmojis: [
              CREATE_EMOJI_TILE,
              ...(customEmojis ?? []).map((e) => ({ ...e, group: MY_EMOJIS_GROUP })),
            ],
          }
        : { customEmojis })}
      onEmojiClick={handleClick}
    />
  );
}
