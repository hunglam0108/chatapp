"use client"

import * as React from "react"
import { clsx } from "clsx"
import { useSidebar } from "@/components/ui/sidebar"
import { PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react"

const SIDEBAR_WIDTH_COOKIE = "sidebar_width"

const WIDTH_PRESETS = [
  { label: "Thin", value: "16rem" },
  { label: "Wide", value: "19rem" },
  { label: "Full", value: "22rem" },
]

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`),
  )
  return match?.[1]
}

export function SidebarAdjustableRail({
  className,
  ...props
}: React.ComponentProps<"button">) {
  const { state, toggleSidebar } = useSidebar()
  const [showWidthPopover, setShowWidthPopover] = React.useState(false)
  const [width, setWidth] = React.useState("19rem")

  // Khôi phục độ rộng đã chọn lần trước từ cookie một lần khi mount.
  React.useEffect(() => {
    const saved = readCookie(SIDEBAR_WIDTH_COOKIE)
    if (saved && WIDTH_PRESETS.some((p) => p.value === saved)) {
      setWidth(saved)
    }
  }, [])

  // Lưu mọi thay đổi độ rộng vào cookie dài hạn.
  React.useEffect(() => {
    if (typeof document === "undefined") return
    document.cookie = `${SIDEBAR_WIDTH_COOKIE}=${width}; path=/; max-age=31536000`
  }, [width])

  const chooseWidth = React.useCallback(
    (value: string) => {
      setWidth(value)
      setShowWidthPopover(false)
    },
    [setWidth, setShowWidthPopover],
  )

  const isCollapsed = state === "collapsed"
  const expanded = !isCollapsed

  return (
    <>
      {/* Header của rail luôn hiển thị: nút thu gọn + điều chỉnh độ rộng. */}
      <div
        className={clsx(
          "flex flex-col gap-1 h-full items-center",
          className,
        )}
      >
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={clsx(
            "flex size-6 shrink-0 items-center justify-center rounded-md border bg-sidebar-accent/50",
            "hover:bg-sidebar-accent text-sidebar-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          )}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {expanded && (
          <button
            type="button"
            onClick={() => setShowWidthPopover((v) => !v)}
            aria-label="Adjust sidebar width"
            className={clsx(
              "flex size-6 shrink-0 items-center justify-center rounded-md border bg-sidebar-accent/50",
              "hover:bg-sidebar-accent text-sidebar-foreground transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            )}
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        {showWidthPopover && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowWidthPopover(false)}
            />
            <div
              className="fixed z-50 h-48 w-44 overflow-auto rounded-lg border bg-popover p-2 shadow-lg"
              style={{ top: "6rem", left: "8rem" }}
              role="dialog"
              aria-label="Sidebar width options"
            >
              <p className="mb-1 text-xs font-medium text-popover-foreground">
                Width
              </p>
              {WIDTH_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => chooseWidth(preset.value)}
                  className={clsx(
                    "flex w-full rounded-md px-2 py-1 text-left text-sm transition-colors",
                    "hover:bg-sidebar-accent",
                    width === preset.value
                      ? "bg-sidebar-accent font-medium text-sidebar-foreground"
                      : "text-popover-foreground",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Phần mang độ rộng — rail gốc vẫn nhận event props. */}
      <button
        {...props}
        className={clsx(
          "relative flex w-full items-center justify-center overflow-hidden transition-all duration-200 ease-in-out",
          width === "16rem"
            ? "w-[3rem]"
            : width === "19rem"
            ? "w-[3.75rem]"
            : width === "22rem"
            ? "w-[4.5rem]"
            : "w-full",
          className,
        )}
        style={{
          ...props.style,
          width: isCollapsed ? "3rem" : width,
        }}
      >
        {React.Children.map(
          props.children as React.ReactElement<{ className?: string }> | null | undefined,
          (child) =>
            React.isValidElement(child)
              ? React.cloneElement(child, {
                  className: clsx(
                    child.props.className,
                    isCollapsed ? "hidden" : "",
                  ),
                })
              : null,
        )}
      </button>
    </>
  )
}
