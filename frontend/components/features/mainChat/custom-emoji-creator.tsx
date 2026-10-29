"use client"

import { useEffect, useState } from "react"
import type { RefObject } from "react"
import { Loader2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { emojiStore } from "@/store/emojiStore"

export const MAX_CUSTOM_EMOJIS = 50

/**
 * Input ảnh ẩn (mở bằng ô "+" trong emoji picker) cùng với
 * form đặt tên hiện ra khi đã chọn ảnh. Thêm xong sẽ thành emoji của tôi.
 */
export function CustomEmojiCreator({
  inputRef,
}: {
  inputRef: RefObject<HTMLInputElement | null>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const reset = () => {
    setFile(null)
    setPreview(null)
    setName("")
    if (inputRef.current) inputRef.current.value = ""
  }

  const pickFile = (picked?: File) => {
    if (!picked) return
    setFile(picked)
    setName(
      picked.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^\p{L}\p{N}_-]+/gu, "_")
        .slice(0, 32)
    )
  }

  const add = async () => {
    if (!file || !name.trim()) return
    setBusy(true)
    try {
      await emojiStore.getState().createEmoji(file, name.trim())
      toast.success("Emoji added")
      reset()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add emoji")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pickFile(e.target.files?.[0])}
      />
      {/* Không dùng <form>: phần này render bên trong form composer, form lồng nhau sẽ submit native (reload trang). */}
      {file ? (
        <div className="flex items-center gap-2 rounded-xl border bg-popover p-2 shadow-lg">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              className="size-9 shrink-0 rounded-md object-cover"
            />
          ) : null}
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return
              e.preventDefault()
              void add()
            }}
            placeholder="Emoji name"
            aria-label="Emoji name"
            maxLength={32}
            className="h-9"
            disabled={busy}
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            className="h-9"
            disabled={!name.trim() || busy}
            onClick={() => void add()}
          >
            {busy ? <Loader2Icon className="size-4 animate-spin" /> : "Add"}
          </Button>
          <button
            type="button"
            aria-label="Cancel"
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            disabled={busy}
            onClick={reset}
          >
            <XIcon className="size-4" />
          </button>
        </div>
      ) : null}
    </>
  )
}
