"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { CheckIcon, Loader2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  CHAT_THEMES,
  DEFAULT_QUICK_EMOJI,
  type ChatThemeId,
} from "@/lib/chat-themes"
import { chatStore } from "@/store/chatStore"
import { emojiStore } from "@/store/emojiStore"
import type { Conversation } from "@/types/ConversationType"
import { EmojiPicker } from "./emoji-picker"
import { MAX_CUSTOM_EMOJIS } from "./custom-emoji-creator"

interface ChatSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversation: Conversation
  /** Thành viên đã rời nhóm vẫn quản lý được emoji của mình, nhưng không chỉnh được chat. */
  canEdit: boolean
}

/** Theme chat + quick emoji dùng chung (đồng bộ cho mọi thành viên) và custom emoji của tôi. */
export function ChatSettingsDialog({
  open,
  onOpenChange,
  conversation,
  canEdit,
}: ChatSettingsDialogProps) {
  const [saving, setSaving] = useState(false)
  const [showQuickPicker, setShowQuickPicker] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  if (!open) return null

  const currentTheme = conversation.theme ?? "default"
  const quickEmoji = conversation.quickEmoji ?? DEFAULT_QUICK_EMOJI

  const save = async (settings: { theme?: ChatThemeId; quickEmoji?: string }) => {
    setSaving(true)
    try {
      await chatStore
        .getState()
        .updateConversationSettings(conversation._id, settings)
    } catch {
      toast.error("Could not update chat settings. Try again!")
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Chat settings"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 flex max-h-[90svh] w-full max-w-sm flex-col gap-5 overflow-y-auto rounded-xl border bg-popover p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Chat settings</h2>
          <button
            type="button"
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">Theme</h3>
          <div className="grid grid-cols-3 gap-2">
            {CHAT_THEMES.map((theme) => {
              const active = theme.id === currentTheme
              return (
                <button
                  key={theme.id}
                  type="button"
                  aria-pressed={active}
                  disabled={!canEdit || saving}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-2 text-xs disabled:opacity-60",
                    active ? "border-primary ring-1 ring-primary" : "hover:bg-muted"
                  )}
                  onClick={() => !active && void save({ theme: theme.id })}
                >
                  <span
                    className="relative flex h-10 w-full items-center justify-end rounded-md border bg-background px-1.5"
                    style={{ backgroundImage: theme.background }}
                  >
                    <span
                      className="h-4 w-8 rounded-full"
                      style={{ background: theme.bubble }}
                    />
                    {active ? (
                      <CheckIcon className="absolute left-1.5 size-3.5 text-primary" />
                    ) : null}
                  </span>
                  {theme.label}
                </button>
              )
            })}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            Quick emoji
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-label={`Current quick emoji ${quickEmoji}`}>
              {quickEmoji}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canEdit || saving}
              onClick={() => setShowQuickPicker((v) => !v)}
            >
              {showQuickPicker ? "Cancel" : "Change"}
            </Button>
            {saving ? (
              <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          {showQuickPicker ? (
            <EmojiPicker
              width="100%"
              height={320}
              onEmojiClick={(data) => {
                setShowQuickPicker(false)
                if (data.emoji !== quickEmoji) void save({ quickEmoji: data.emoji })
              }}
            />
          ) : null}
        </section>

        <CustomEmojiManager />
      </div>
    </div>,
    document.body
  )
}

function CustomEmojiManager() {
  const emojis = emojiStore((s) => s.emojis)

  const remove = async (emojiId: string) => {
    try {
      await emojiStore.getState().deleteEmoji(emojiId)
    } catch {
      toast.error("Could not delete emoji")
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">
        My emojis ({emojis.length}/{MAX_CUSTOM_EMOJIS})
      </h3>
      {emojis.length > 0 ? (
        <ul className="grid grid-cols-6 gap-2">
          {emojis.map((emoji) => (
            <li key={emoji._id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={emoji.imgUrl}
                alt={emoji.name}
                title={emoji.name}
                className="size-10 rounded-md object-cover"
              />
              <button
                type="button"
                aria-label={`Delete emoji ${emoji.name}`}
                className="absolute -right-1 -top-1 rounded-full border bg-popover p-0.5 text-muted-foreground opacity-0 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                onClick={() => void remove(emoji._id)}
              >
                <XIcon className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          No emojis yet. Use the + button in the emoji picker to create one
          from an image.
        </p>
      )}
    </section>
  )
}
