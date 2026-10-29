"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { PlusIcon, SmilePlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Reaction } from "@/types/ConversationType";
import { emojiStore } from "@/store/emojiStore";
import { EmojiPicker } from "./emoji-picker";

const DEFAULT_REACTIONS = ["👍", "❤️", "😆", "😮", "😢", "😡"];

/** Reaction là emoji gốc, hoặc URL ảnh với custom emoji. */
const isImageEmoji = (emoji: string) => /^https?:\/\//.test(emoji);

function ReactionEmoji({ emoji, className }: { emoji: string; className?: string }) {
  if (!isImageEmoji(emoji)) return <span>{emoji}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={emoji} alt="" className={cn("object-contain", className)} />;
}

/**
 * Nút mặt cười cạnh bubble tin nhắn: mở thanh reaction nhanh kiểu Messenger,
 * kèm "+" để mở picker đầy đủ. Render qua portal để danh sách
 * tin nhắn cuộn không cắt mất nó.
 */
export function ReactionPicker({
  align,
  onPick,
}: {
  align: "start" | "end";
  onPick: (emoji: string) => void;
}) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const customEmojis = emojiStore((s) => s.emojis);

  const close = () => {
    setStyle(null);
    setShowFullPicker(false);
  };

  const pick = (emoji: string) => {
    close();
    onPick(emoji);
  };

  const open = (target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const top = Math.max(8, rect.top - 52);
    setStyle(
      align === "end"
        ? { top, right: Math.max(8, window.innerWidth - rect.right) }
        : { top, left: Math.max(8, rect.left) }
    );
  };

  return (
    <>
      <button
        type="button"
        aria-label="React to message"
        title="React"
        className="shrink-0 self-center rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-60"
        onClick={(e) => open(e.currentTarget)}
      >
        <SmilePlusIcon className="size-4" />
      </button>

      {style && typeof document !== "undefined"
        ? createPortal(
            <>
              <div className="fixed inset-0 z-40" onClick={close} />
              <div className="fixed z-50" style={style}>
                {showFullPicker ? (
                  <EmojiPicker
                    customEmojis={customEmojis.map((e) => ({
                      id: e._id,
                      names: [e.name],
                      imgUrl: e.imgUrl,
                    }))}
                    onEmojiClick={(data) =>
                      pick(data.isCustom ? data.imageUrl : data.emoji)
                    }
                  />
                ) : (
                  <div
                    role="toolbar"
                    aria-label="Reactions"
                    className="flex items-center gap-0.5 rounded-full border bg-popover p-1 shadow-lg"
                  >
                    {DEFAULT_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        aria-label={`React ${emoji}`}
                        className="rounded-full p-1 text-xl transition-transform hover:scale-125"
                        onClick={() => pick(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-label="More reactions"
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => setShowFullPicker(true)}
                    >
                      <PlusIcon className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            </>,
            document.body
          )
        : null}
    </>
  );
}

/** Chip reaction dưới bubble: mỗi emoji một chip kèm số lượng; của mình được highlight. */
export function ReactionChips({
  reactions,
  currentUserId,
  disabled,
  onToggle,
}: {
  reactions: Reaction[];
  currentUserId?: string;
  disabled?: boolean;
  onToggle: (emoji: string) => void;
}) {
  if (reactions.length === 0) return null;

  const groups = new Map<string, { count: number; mine: boolean }>();
  for (const r of reactions) {
    const group = groups.get(r.emoji) ?? { count: 0, mine: false };
    group.count += 1;
    group.mine ||= String(r.userId) === String(currentUserId);
    groups.set(r.emoji, group);
  }

  return (
    <div className="-mt-1.5 flex flex-wrap gap-1 px-1">
      {[...groups].map(([emoji, { count, mine }]) => (
        <button
          key={emoji}
          type="button"
          disabled={disabled}
          aria-pressed={mine}
          aria-label={`${isImageEmoji(emoji) ? "Custom emoji" : emoji} ${count}`}
          className={cn(
            "flex items-center gap-0.5 rounded-full border bg-popover px-1.5 py-0.5 text-xs shadow-xs",
            mine && "border-primary bg-primary/10",
            !disabled && "hover:bg-muted"
          )}
          onClick={() => onToggle(emoji)}
        >
          <ReactionEmoji emoji={emoji} className="size-4" />
          {count > 1 ? <span className="tabular-nums text-muted-foreground">{count}</span> : null}
        </button>
      ))}
    </div>
  );
}
