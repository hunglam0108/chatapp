"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import * as sidebar from "@/components/ui/sidebar"

export const SIDEBAR: { className?: string } = {
  className: undefined,
}

export const COLLAPSIBLE: {
  className?: string
  collapsible: "icon"
} = {
  className: undefined,
  collapsible: "icon",
}

export const GROUPS: {
  className?: string
  groups: React.ReactNode[]
} = {
  className: undefined,
  groups: [],
}

export const RAIL: {
  className?: string
  props: React.ComponentProps<typeof sidebar.SidebarRail>
} = {
  className: undefined,
  props: {},
}

export const SEARCH = {
  getCurrentSearch: () => "",
}

export type FooterProps = React.HTMLAttributes<HTMLElement>

export function Footer(props: FooterProps) {
  const { children, className, ...rest } = props
  return (
    <div
      className={cn(
        "grid gap-1 px-2 py-2 text-sm font-medium text-muted-foreground",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

export type GroupProps = Omit<React.HTMLAttributes<HTMLElement>, "title"> & {
  title?: string
}

export function Group(props: GroupProps) {
  const { children, className, title, ...rest } = props
  return (
    <div
      className={cn(
        "group-data-[collapsible=icon]:mb-2",
        "group-data-[collapsible=icon]:border-b group-data-[collapsible=icon]:border-sidebar-border/40",
        "group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-1",
        className,
      )}
      title={title}
      {...rest}
    >
      {children}
    </div>
  )
}

export type KeyboardShortcutProps = React.HTMLAttributes<HTMLSpanElement>

export function KeyboardShortcut(props: KeyboardShortcutProps) {
  const { className, ...rest } = props
  return (
    <kbd
      className={cn(
        "pointer-events-none select-none rounded border border-sidebar-border/40 bg-sidebar-accent/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
        className,
      )}
      {...rest}
    />
  )
}

export type PromptTooltipProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode
  content: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
}

export function PromptTooltip(props: PromptTooltipProps) {
  const { children, content, side = "top", className, ...rest } = props
  return (
    <div className="relative">
      {children}
      {typeof document !== "undefined" ? (
        <div
          data-side={side}
          className={cn(
            "absolute z-50 hidden group-data-[side=left]:-left-16 group-data-[side=right]:-right-16 group-data-[side=top]:-top-96 group-data-[side=bottom]:-bottom-96",
            "text-xs font-medium text-muted-foreground",
            className,
          )}
          {...rest}
        >
          {content}
        </div>
      ) : null}
    </div>
  )
}
