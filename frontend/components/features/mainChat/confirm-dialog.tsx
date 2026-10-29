"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { Loader2Icon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  /** Hiển thị nút xác nhận theo style destructive. */
  destructive?: boolean
  submitting?: boolean
  onConfirm: () => void
}

/**
 * Modal xác nhận tối giản (dùng portal, cùng pattern với
 * CreateGroupDialog) cho các action nguy hiểm với nhóm như rời/xóa.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  submitting = false,
  onConfirm,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onOpenChange(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, submitting, onOpenChange])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !submitting && onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-sm rounded-xl border bg-popover p-4 shadow-lg">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
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
        <p className="text-sm text-muted-foreground">{description}</p>

        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={submitting}
            className={cn(destructive && "bg-destructive text-white hover:bg-destructive/90")}
          >
            {submitting ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
