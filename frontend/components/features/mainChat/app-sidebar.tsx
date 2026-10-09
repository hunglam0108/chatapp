"use client"

import * as React from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { SidebarSearch } from "./sidebar-search"
import { ChatList } from "./chat-list"
import { FriendList } from "./friend-list"
import { FriendRequests } from "./friend-requests"
import { NavUser } from "./nav-user"
import { authStore } from "@/store/authStore"
import { MessageSquareIcon } from "lucide-react"

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const user = authStore((s) => s.user)
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="pt-3 pb-2 gap-2 group-data-[collapsible=icon]:px-0">
        <div className="flex items-center justify-between px-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <MessageSquareIcon className="size-3.5" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              Chat
            </span>
          </div>
          <SidebarTrigger
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="size-7 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          />
        </div>
        <SidebarSearch />
      </SidebarHeader>

      <SidebarContent className="gap-2 group-data-[collapsible=icon]:hidden">
        <FriendRequests />
        <ChatList />
        <FriendList />
      </SidebarContent>

      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        {user ? (
          <NavUser
            user={{
              name: user.fullName || user.username || "User",
              email: user.email || "",
              avatar: user.urlAvatar || "",
            }}
          />
        ) : null}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
