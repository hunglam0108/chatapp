"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar"
import { friendStore } from "@/store/friendStore"
import { chatStore } from "@/store/chatStore"
import { socketStore } from "@/store/socketStore"
import { CollapsibleSection } from "./collapsible-section"

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("")
}

/**
 * Friends section. Shows ALL friends — including ones you have no
 * conversation with yet — with a "Chat" action that creates/opens the
 * direct conversation with that friend.
 */
export function FriendList() {
  const friends = friendStore((s) => s.friends)
  const conversations = chatStore((s) => s.conversations)
  const onlineUsers = socketStore((s) => s.onlineUsers)

  const startChat = async (friendId: string) => {
    // If a direct conversation already exists with this friend, open it.
    const existing = conversations.find(
      (c) =>
        c.type === "direct" &&
        c.participants.some((p) => p._id === friendId)
    )
    if (existing) {
      chatStore.getState().setActiveConversation(existing._id)
      void chatStore.getState().fetchMessages(existing._id)
      return
    }

    // Otherwise create one (backend reuses an existing direct convo if any).
    await chatStore.getState().createConversation("direct", "", [friendId])
    const active = chatStore.getState().activeConversationId
    if (active) {
      void chatStore.getState().fetchMessages(active)
    }
  }

  return (
    <CollapsibleSection label="Friends" count={friends.length}>
      <SidebarMenu>
        {friends.length === 0 ? (
          <li className="px-2 py-1 text-xs text-muted-foreground">
            No friends yet — use search above to add some
          </li>
        ) : (
          friends.map((friend) => {
            const isOnline = onlineUsers.includes(friend._id)
            return (
              <SidebarMenuItem key={friend._id}>
                <div className="group/friend flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent">
                  <div className="relative shrink-0">
                    <Avatar size="sm">
                      {friend.avatarUrl ? (
                        <AvatarImage src={friend.avatarUrl} alt={friend.displayName} />
                      ) : null}
                      <AvatarFallback>{initials(friend.displayName) || "?"}</AvatarFallback>
                    </Avatar>
                    {isOnline ? (
                      <span
                        aria-label="Online"
                        className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-sidebar"
                      />
                    ) : null}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {friend.displayName}
                  </span>
                  <button
                    type="button"
                    onClick={() => void startChat(friend._id)}
                    className="shrink-0 rounded-md border border-sidebar-border px-2 py-0.5 text-xs text-sidebar-foreground/80 opacity-0 transition-all focus-visible:opacity-100 group-hover/friend:opacity-100 hover:bg-primary hover:text-primary-foreground"
                  >
                    Chat
                  </button>
                </div>
              </SidebarMenuItem>
            )
          })
        )}
      </SidebarMenu>
    </CollapsibleSection>
  )
}
