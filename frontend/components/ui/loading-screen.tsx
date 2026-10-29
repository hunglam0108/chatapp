"use client"

import { Loader2Icon } from "lucide-react"
import { cn } from "@/lib/utils"

/** Trạng thái loading toàn màn hình, căn giữa (kiểm tra auth, route guard, v.v.). */
export function LoadingScreen({
  label = "Loading...",
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background text-muted-foreground",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2Icon className="size-8 animate-spin text-primary" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
