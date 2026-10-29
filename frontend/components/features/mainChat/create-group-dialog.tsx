"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { CheckIcon, Loader2Icon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { friendStore } from "@/store/friendStore"
import { chatStore } from "@/store/chatStore"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("")
}

interface CreateGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Modal tạo group chat: nhập tên, chọn bạn bè từ danh sách,
 * rồi bấm Create. Render qua portal để thoát khỏi overflow của sidebar.
 */
export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const friends = friendStore((s) => s.friends)
  const [name, setName] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onOpenChange(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, submitting, onOpenChange])

  if (!open) return null

  const toggleFriend = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
    if (error) setError(null)
  }

  const handleCreate = async () => {
    if (selected.size === 0) {
      setError("Select at least one friend to add")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      // Backend tự thêm người tạo. Nếu có nhập tên,
      // gửi lên để nhóm giữ tên tùy chỉnh; nếu không backend sẽ đặt
      // tên mặc định "Group chat of {creator} #{shortId}" và client đọc lại
      // sau khi tạo.
      await chatStore.getState().createConversation(
        "group",
        name.trim() || "",
        [...selected]
      )
      toast.success("Group created")
      onOpenChange(false)
      setName("")
      setSelected(new Set())
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Failed to create group"
      )
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create group chat"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !submitting && onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-sm rounded-xl border bg-popover p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Create group chat</h2>
          <button
            type="button"
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <label htmlFor="group-name" className="mb-1 block text-xs text-muted-foreground">
          Group name
        </label>
        <Input
          id="group-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (error) setError(null)
          }}
          placeholder="e.g. Project team"
          className="mb-3"
          autoFocus
        />

        <p className="mb-1 text-xs text-muted-foreground">
          Members ({selected.size} selected)
        </p>
        <div className="max-h-56 overflow-y-auto rounded-lg border">
          {friends.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No friends yet — add friends first
            </p>
          ) : (
            <ul className="p-1">
              {friends.map((friend) => {
                const isSelected = selected.has(friend._id)
                return (
                  <li key={friend._id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleFriend(friend._id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                        "hover:bg-muted",
                        isSelected && "bg-primary/10"
                      )}
                    >
                      <Avatar size="sm">
                        {friend.avatarUrl ? (
                          <AvatarImage
                            src={friend.avatarUrl}
                            alt={friend.displayName}
                          />
                        ) : null}
                        <AvatarFallback>
                          {initials(friend.displayName) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {friend.displayName}
                      </span>
                      {isSelected ? (
                        <CheckIcon className="size-4 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {error ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={submitting}>
            {submitting ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : null}
            Create
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
