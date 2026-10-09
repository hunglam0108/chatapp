"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { UsersIcon } from "lucide-react";
import { chatStore } from "@/store/chatStore";
import { authStore } from "@/store/authStore";
import { socketStore } from "@/store/socketStore";
import type { Conversation } from "@/types/ConversationType";
import { cn } from "@/lib/utils";
import { CollapsibleSection } from "./collapsible-section";
import { CreateGroupDialog } from "./create-group-dialog";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function timeLabel(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
}

function ChatRow({
  conversation,
  title,
  avatarUrl,
  isGroup,
  isOnline,
  unread,
  active,
  onSelect,
}: {
  conversation: Conversation;
  title: string;
  avatarUrl?: string | null;
  isGroup: boolean;
  isOnline: boolean;
  unread: number;
  active: boolean;
  onSelect: () => void;
}) {
  const currentUserId = authStore((s) => s.user?._id);
  const preview = conversation.lastMessage?.content ?? "No messages yet";
  const previewPrefix =
    conversation.lastMessage &&
    conversation.lastMessage.sender?._id === currentUserId
      ? "You: "
      : conversation.type === "group" && conversation.lastMessage
        ? `${conversation.lastMessage.sender?.displayName || "User"}: `
        : "";

  return (
    <SidebarMenuItem>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={cn(
          "group/chat flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-2 text-left transition-colors outline-none",
          "hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          active && "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"
        )}
      >
        <div className="relative shrink-0">
          <Avatar size="default">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={title} /> : null}
            <AvatarFallback className={isGroup ? "bg-primary/15 text-primary" : undefined}>
              {isGroup ? <UsersIcon className="size-4" /> : initials(title) || "?"}
            </AvatarFallback>
          </Avatar>
          {isOnline ? (
            <span
              aria-label="Online"
              className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-sidebar"
            />
          ) : null}
        </div>
        <div className="grid min-w-0 flex-1 gap-0.5 text-left">
          <span className="truncate text-sm font-medium">{title}</span>
          <span className="truncate text-xs text-muted-foreground">
            {previewPrefix}
            {preview}
          </span>
        </div>
        <span className="ml-auto flex shrink-0 flex-col items-end gap-1">
          <span className="text-[10px] text-muted-foreground">
            {timeLabel(conversation.lastMessage?.createdAt ?? conversation.lastMessageAt)}
          </span>
          {unread > 0 ? (
            <span
              className={cn(
                "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[9px] font-semibold",
                active
                  ? "bg-sidebar-accent-foreground text-sidebar-accent"
                  : "bg-primary text-primary-foreground"
              )}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </span>
      </button>
    </SidebarMenuItem>
  );
}

/**
 * Sidebar conversations: a single list of all chats (direct + group),
 * sorted most-recent first.
 */
export function ChatList() {
  const [createOpen, setCreateOpen] = useState(false);
  const conversations = chatStore((s) => s.conversations);
  const activeConversationId = chatStore((s) => s.activeConversationId);
  const setActiveConversation = chatStore((s) => s.setActiveConversation);
  const onlineUsers = socketStore((s) => s.onlineUsers);
  const currentUserId = authStore((s) => s.user?._id);

  const sorted = [...conversations].sort((a, b) => {
    const aTime = new Date(a.lastMessage?.createdAt ?? a.lastMessageAt).getTime();
    const bTime = new Date(b.lastMessage?.createdAt ?? b.lastMessageAt).getTime();
    return bTime - aTime;
  });

  const select = (conversationId: string) => {
    if (conversationId === activeConversationId) return;
    setActiveConversation(conversationId);
    void chatStore.getState().fetchMessages(conversationId);
  };

  const renderItem = (conversation: Conversation) => {
    const otherParticipant =
      conversation.type === "direct"
        ? (conversation.participants.find((p) => p._id !== currentUserId) ?? null)
        : null;

    return (
      <ChatRow
        key={conversation._id}
        conversation={conversation}
        title={
          conversation.type === "group"
            ? (conversation.group?.name ?? "Group chat")
            : (otherParticipant?.displayName ?? "Direct chat")
        }
        avatarUrl={otherParticipant?.avatarUrl ?? null}
        isGroup={conversation.type === "group"}
        isOnline={
          conversation.type === "direct" &&
          !!otherParticipant &&
          onlineUsers.includes(otherParticipant._id)
        }
        unread={currentUserId ? (conversation.unreadCounts?.[currentUserId] ?? 0) : 0}
        active={conversation._id === activeConversationId}
        onSelect={() => select(conversation._id)}
      />
    );
  };

  return (
    <>
      <CollapsibleSection
        label="Chats"
        count={sorted.length}
        action={
          <button
            type="button"
            aria-label="Create group chat"
            title="Create group chat"
            onClick={() => setCreateOpen(true)}
            className="flex size-5 items-center justify-center rounded-md border border-sidebar-border bg-background text-sidebar-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <PlusIcon className="size-3.5" />
          </button>
        }
      >
        <SidebarMenu>
          {sorted.length === 0 ? (
            <li className="px-2 py-1 text-xs text-muted-foreground">
              No chats yet — say hi to a friend or create a group
            </li>
          ) : (
            sorted.map(renderItem)
          )}
        </SidebarMenu>
      </CollapsibleSection>

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
