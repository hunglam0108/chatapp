"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CheckIcon, ImagePlusIcon, Loader2Icon, PipetteIcon, Trash2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn, getErrorMessage } from "@/lib/utils"
import {
  CHAT_THEMES,
  CUSTOM_BUBBLE_COLORS,
  CUSTOM_THEME_ID,
  DEFAULT_QUICK_EMOJI,
  customBackground,
  readableForeground,
} from "@/lib/chat-themes"
import { uploadFile } from "@/server/upload"
import type { ChatSettings } from "@/server/chat"
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
  const [uploading, setUploading] = useState(false)
  const [showQuickPicker, setShowQuickPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
  const backgroundUrl = conversation.backgroundUrl ?? null
  const bubbleColor = conversation.bubbleColor ?? null
  const quickEmoji = conversation.quickEmoji ?? DEFAULT_QUICK_EMOJI
  const customActive = currentTheme === CUSTOM_THEME_ID && !!backgroundUrl
  const busy = !canEdit || saving || uploading

  // Theme Custom (ảnh + màu) được giữ lại khi chuyển sang theme khác, bấm ô Custom để bật lại.
  const pickCustomImage = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file")
      return
    }
    setUploading(true)
    try {
      const { url } = await uploadFile(file)
      await save({ theme: CUSTOM_THEME_ID, backgroundUrl: url })
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not upload the background. Try again!"))
    } finally {
      setUploading(false)
    }
  }

  const save = async (settings: ChatSettings) => {
    setSaving(true)
    try {
      await chatStore
        .getState()
        .updateConversationSettings(conversation._id, settings)
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not update chat settings. Try again!"))
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
              const active = !customActive && theme.id === currentTheme
              return (
                <button
                  key={theme.id}
                  type="button"
                  aria-pressed={active}
                  disabled={busy}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-2 text-xs disabled:opacity-60",
                    active ? "border-primary ring-1 ring-primary" : "hover:bg-muted"
                  )}
                  onClick={() => !active && void save({ theme: theme.id })}
                >
                  <span
                    className="relative flex h-10 w-full items-center justify-end rounded-md border bg-background px-1.5"
                    style={{
                      backgroundImage: theme.background,
                      backgroundSize: "cover",
                      backgroundPosition: "center bottom",
                    }}
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
            <button
              type="button"
              aria-pressed={customActive}
              title={backgroundUrl ? "Use your custom theme" : "Upload a background image"}
              disabled={busy}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-2 text-xs disabled:opacity-60",
                customActive ? "border-primary ring-1 ring-primary" : "hover:bg-muted"
              )}
              onClick={() =>
                !backgroundUrl
                  ? fileInputRef.current?.click()
                  : !customActive && void save({ theme: CUSTOM_THEME_ID })
              }
            >
              <span
                className="relative flex h-10 w-full items-center justify-end rounded-md border bg-background px-1.5"
                style={
                  backgroundUrl
                    ? {
                        backgroundImage: customBackground(backgroundUrl),
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              >
                {uploading ? (
                  <Loader2Icon className="absolute inset-0 m-auto size-4 animate-spin text-muted-foreground" />
                ) : backgroundUrl ? (
                  <>
                    <span
                      className="h-4 w-8 rounded-full"
                      style={{ background: bubbleColor ?? CHAT_THEMES[0].bubble }}
                    />
                    {customActive ? (
                      <CheckIcon className="absolute left-1.5 size-3.5 text-primary" />
                    ) : null}
                  </>
                ) : (
                  <ImagePlusIcon className="absolute inset-0 m-auto size-4 text-muted-foreground" />
                )}
              </span>
              Custom
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void pickCustomImage(e.target.files?.[0])
                e.target.value = ""
              }}
            />
          </div>
        </section>

        {customActive ? (
          <>
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-medium text-muted-foreground">Custom background</h3>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlusIcon />
                  Change image
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() =>
                    void save({ theme: "default", backgroundUrl: null, bubbleColor: null })
                  }
                >
                  <Trash2Icon />
                  Remove
                </Button>
              </div>
            </section>
            <BubbleColorPicker
              value={bubbleColor}
              disabled={busy}
              onChange={(color) => void save({ bubbleColor: color })}
            />
          </>
        ) : null}

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

/** Màu bubble của theme Custom: Default, các màu gợi ý, hoặc màu tự chọn. */
function BubbleColorPicker({
  value,
  disabled,
  onChange,
}: {
  value: string | null
  disabled: boolean
  onChange: (color: string | null) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const swatch =
    "relative size-7 shrink-0 rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
  const isCustomColor = !!value && !CUSTOM_BUBBLE_COLORS.includes(value)
  const freeColor = draft ?? (isCustomColor ? value : null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  // Ô chọn màu bắn change liên tục khi kéo: chỉ lưu khi user dừng lại.
  const pickFree = (color: string) => {
    setDraft(color)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDraft(null)
      if (color !== value) onChange(color)
    }, 400)
  }

  const check = (color: string) => (
    <CheckIcon
      className="absolute inset-0 m-auto size-3.5"
      style={{ color: readableForeground(color) }}
    />
  )

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">Bubble color</h3>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-label="Default bubble color"
          aria-pressed={!value}
          title="Default"
          disabled={disabled}
          className={cn(swatch, !value && "ring-2 ring-primary ring-offset-2 ring-offset-popover")}
          style={{ background: CHAT_THEMES[0].bubble }}
          onClick={() => value && onChange(null)}
        >
          {!value ? <CheckIcon className="absolute inset-0 m-auto size-3.5 text-primary-foreground" /> : null}
        </button>
        {CUSTOM_BUBBLE_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Bubble color ${color}`}
            aria-pressed={value === color}
            disabled={disabled}
            className={cn(swatch, value === color && "ring-2 ring-primary ring-offset-2 ring-offset-popover")}
            style={{ background: color }}
            onClick={() => value !== color && onChange(color)}
          >
            {value === color ? check(color) : null}
          </button>
        ))}
        {/* Viền cầu vồng + icon ống hút luôn hiện để user biết ô này mở bảng chọn màu. */}
        <label
          title={freeColor ? `Custom color ${freeColor} — click to change` : "Pick any color"}
          className={cn(
            swatch,
            "flex cursor-pointer items-center justify-center bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] p-[3px]",
            isCustomColor && "ring-2 ring-primary ring-offset-2 ring-offset-popover"
          )}
        >
          <span
            className="flex size-full items-center justify-center rounded-full"
            style={freeColor ? { background: freeColor } : { background: "var(--popover)" }}
          >
            <PipetteIcon
              className="size-3.5"
              style={{ color: freeColor ? readableForeground(freeColor) : "var(--foreground)" }}
            />
          </span>
          <input
            type="color"
            aria-label="Pick any bubble color"
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            disabled={disabled}
            value={draft ?? value ?? "#8b5cf6"}
            onChange={(e) => pickFree(e.target.value)}
          />
        </label>
      </div>
    </section>
  )
}

function CustomEmojiManager() {
  const emojis = emojiStore((s) => s.emojis)

  const remove = async (emojiId: string) => {
    try {
      await emojiStore.getState().deleteEmoji(emojiId)
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not delete emoji"))
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
