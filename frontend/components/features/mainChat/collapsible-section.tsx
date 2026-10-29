"use client"

import { useState } from "react"
import { ChevronDownIcon } from "lucide-react"
import { SidebarGroup } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

interface CollapsibleSectionProps {
  label: string
  count?: number
  defaultOpen?: boolean
  /** Control phụ ở header (vd. nút "+"); click vào không toggle. */
  action?: React.ReactNode
  children: React.ReactNode
}

/**
 * Section của sidebar có header để toggle. Header hoạt động như một nút:
 * khi hover hiện viền và đổi màu nền, click vào
 * sẽ hiện/ẩn danh sách bên trong. Nội dung có chiều cao tối đa và
 * cuộn khi bị tràn.
 */
export function CollapsibleSection({
  label,
  count,
  defaultOpen = true,
  action,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <SidebarGroup>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md border border-transparent px-2 py-1.5",
          "text-xs font-medium text-sidebar-foreground/70 transition-colors outline-none",
          "hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          "focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        )}
      >
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-200",
            !open && "-rotate-90"
          )}
        />
        <span>{label}</span>
        {/* {typeof count === "number" && count > 0 ? (
          <span className="ml-auto text-[10px] font-normal text-muted-foreground">
            {count}
          </span>
        ) : null} */}
        {action ? (
          <span
            className={cn("ml-auto flex items-center", count ? "ml-1.5" : "")}
            onClick={(e) => e.stopPropagation()}
          >
            {action}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="mt-1 max-h-72 overflow-y-auto pr-0.5">{children}</div>
      ) : null}
    </SidebarGroup>
  )
}
