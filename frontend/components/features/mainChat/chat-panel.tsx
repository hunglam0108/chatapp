"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
import type { EmojiClickData } from "emoji-picker-react";
import {
  Loader2Icon,
  LogOutIcon,
  PanelLeftIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] w-[320px] items-center justify-center rounded-2xl border bg-popover shadow-lg">
      <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
    </div>
  ),
});
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { chatStore } from "@/store/chatStore";
import { authStore } from "@/store/authStore";
import {
  useConversationMeta,
  useSendMessage,
} from "@/hooks/use-chat";
import type { Message } from "@/types/ConversationType";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "./confirm-dialog";
import { createPortal } from "react-dom";
import type { Conversation, Participant } from "@/types/ConversationType";

// --- inline helpers -------------------------------------------------------------------

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function timeLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MessageRow({
  message,
  showAvatar,
  isGroup,
  sender,
}: {
  message: Message;
  showAvatar: boolean;
  isGroup: boolean;
  sender?: { displayName: string; avatarUrl?: string | null };
}) {
  const currentUserId = authStore((s) => s.user?._id);
  const isOwn =
    message.isOwn ??
    Boolean(currentUserId && String(message.senderId) === String(currentUserId));

  const senderName = sender?.displayName || (isOwn ? "You" : "User");

  return (
    <div
      className={cn(
        "flex w-full gap-2",
        isOwn ? "justify-end" : "justify-start items-center"
      )}
    >
      {!isOwn && (
        <div className="size-10 shrink-0 mt-2">
          {showAvatar ? (
            <Avatar size="default" className="size-10">
              {sender?.avatarUrl ? (
                <AvatarImage src={sender.avatarUrl} alt={senderName} />
              ) : null}
              <AvatarFallback className="text-[11px] font-semibold bg-muted text-muted-foreground">
                {initials(senderName) || "?"}
              </AvatarFallback>
            </Avatar>
          ) : null}
        </div>
      )}
      <div
        className="max-w-[65%] flex flex-col"
      >
        {isGroup && !isOwn && showAvatar ? (
          <p className="mb-1 ml-2 text-[10px] font-semibold text-primary/90">
            {senderName}
          </p>
        ) : null}
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm shadow-xs",
            isOwn
              ? "rounded-br-xs bg-primary text-primary-foreground"
              : "rounded-bl-xs bg-muted text-foreground"
          )}
        >

          {message.content ? (
            <p className="break-words whitespace-pre-wrap leading-relaxed">
              {message.content}
            </p>
          ) : null}
          {message.imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.imgUrl}
              alt="Attachment"
              className="mt-1.5 max-h-64 rounded-lg object-contain"
            />
          ) : null}
          <p
            className={cn(
              "mt-1 text-[9px]",
              isOwn ? "text-primary-foreground/75 text-right" : "text-muted-foreground"
            )}
          >
            {timeLabel(message.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Main chat area: header + scrolling message list + composer, stacked in a
 * flex column that fills the SidebarInset. The list scrolls while the header
 * and composer stay pinned (min-h-0 lets the list shrink instead of pushing
 * the composer off-screen).
 */
export function ChatPanel() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <ChatHeader />
      <MessageList />
      <MessageComposer />
    </div>
  );
}

// Module-level cache mapping userId -> participant info, fed from the active
// conversation. Avoids prop drilling participants through every message row.
const senderCache = new Map<
  string,
  { displayName: string; avatarUrl?: string | null }
>();

export function ChatHeader() {
  const { isMobile } = useSidebar();
  const activeConversationId = chatStore((s) => s.activeConversationId);
  const meta = useConversationMeta(activeConversationId);
  const [confirmAction, setConfirmAction] = useState<
    null | "leave" | "delete"
  >(null);
  const [busy, setBusy] = useState(false);

  if (!meta) return null;

  const { conversation } = meta;
  const isGroup = conversation.type === "group";
  const hasLeftGroup = isGroup && !meta.isMember;

  const closeConfirm = () => {
    if (!busy) setConfirmAction(null);
  };

  const handleLeave = async () => {
    if (!activeConversationId) return;
    setBusy(true);
    try {
      await chatStore.getState().leaveGroup(activeConversationId);
      toast.success("You left the group");
      setConfirmAction(null);
    } catch {
      toast.error("Could not leave the group. Try again!");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!activeConversationId) return;
    setBusy(true);
    try {
      await chatStore.getState().deleteGroup(activeConversationId);
      toast.success("Group deleted");
      setConfirmAction(null);
    } catch {
      toast.error("Could not delete the group. Try again!");
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
      {isMobile ? <SidebarTrigger className="-ml-1" /> : null}
      <Avatar>
        {meta.otherParticipant?.avatarUrl ? (
          <AvatarImage
            src={meta.otherParticipant.avatarUrl}
            alt={meta.title}
          />
        ) : null}
        <AvatarFallback>{initials(meta.title) || "?"}</AvatarFallback>
      </Avatar>

      <div className="grid leading-tight">
        <span className="font-semibold">{meta.title}</span>
        <span className="text-xs text-muted-foreground">
          {isGroup
            ? hasLeftGroup
              ? "You left this group"
              : "Group chat"
            : meta.isOnline
              ? "Online"
              : "Offline"}
        </span>
      </div>

      {isGroup && (
        <ClubHashRow
          conversation={conversation}
          isLeft={hasLeftGroup}
          onLeave={() => setConfirmAction("leave")}
          onDelete={() => setConfirmAction("delete")}
          isCreator={meta.isCreator}
        />
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {isGroup && meta.isCreator ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete group"
            title="Delete group"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmAction("delete")}
          >
            <Trash2Icon />
          </Button>
        ) : null}
        {isGroup && meta.isMember ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Leave group"
            title="Leave group"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmAction("leave")}
          >
            <LogOutIcon />
          </Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmAction === "leave"}
        onOpenChange={(open) => (open ? setConfirmAction("leave") : closeConfirm())}
        title="Leave this group?"
        description={`You will stop receiving new messages from "${meta.title}", but you can still read the old chat history.`}
        confirmLabel="Leave group"
        destructive
        submitting={busy}
        onConfirm={() => void handleLeave()}
      />
      <ConfirmDialog
        open={confirmAction === "delete"}
        onOpenChange={(open) => (open ? setConfirmAction("delete") : closeConfirm())}
        title="Delete this group?"
        description={`"${meta.title}" and all of its messages will be permanently removed for every member.`}
        confirmLabel="Delete group"
        destructive
        submitting={busy}
        onConfirm={() => void handleDelete()}
      />
    </header>
  );
}

function MessageList() {
  const activeConversationId = chatStore((s) => s.activeConversationId);
  const messagesState = chatStore((s) =>
    activeConversationId ? s.messages[activeConversationId] : undefined
  );
  const messageLoading = chatStore((s) => s.messageLoading);
  const meta = useConversationMeta(activeConversationId);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { isMobile } = useSidebar();

  const items = messagesState?.items ?? [];

  // Keep the sender cache for group chats in sync with conversation members.
  // Former members are included so old messages keep their sender names.
  useEffect(() => {
    if (!meta) return;
    meta.conversation.participants.forEach((p) => {
      senderCache.set(p._id, { displayName: p.displayName, avatarUrl: p.avatarUrl });
    });
    (meta.conversation.formerMembers ?? []).forEach((fm) => {
      senderCache.set(fm._id, { displayName: fm.displayName, avatarUrl: fm.avatarUrl });
    });
  }, [meta]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items.length]);

  if (!activeConversationId) {
    return (
      <div className="relative flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
        {/* The chat header (and its sidebar trigger) is hidden until a
            conversation is active, so the empty state needs its own trigger
            or the sidebar is unreachable on small screens. */}
        {isMobile ? (
          <SidebarTrigger className="absolute left-2 top-2" />
        ) : null}
        <PanelLeftIcon className="size-8" />
        <p className="text-sm">Select a chat to start messaging</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messageLoading && items.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2Icon className="size-5 animate-spin" />
        </div>
      ) : null}
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
        {items.map((message, index) => {
          const prev = items[index - 1];
          const showAvatar =
            !prev || prev.senderId !== message.senderId;
          return (
            <MessageRow
              key={message._id}
              message={message}
              showAvatar={showAvatar}
              isGroup={meta?.conversation.type === "group"}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function MessageComposer() {
  const [value, setValue] = useState("");
  const sendMessage = useSendMessage();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false); 
  const inputRef = useRef<HTMLTextAreaElement>(null); 
  const cursorRef = useRef(0);

  const handleEmojiClick = (emojiData: EmojiClickData) => { 
    const input = inputRef.current; 
    const cursorPosition = input?.selectionStart ?? cursorRef.current; 
    const newMessage = value.slice(0, cursorPosition) + value.slice(cursorPosition) + emojiData.emoji; 
    setValue(newMessage); 
    setShowEmojiPicker(false); 
    requestAnimationFrame(() => { 
      if (!input) return; 
      const nextCursor = cursorPosition + emojiData.emoji.length; 
      input.focus(); 
      input.setSelectionRange(nextCursor, nextCursor); 
    }); 
  };

  const activeConversationId = chatStore((s) => s.activeConversationId);
  const meta = useConversationMeta(activeConversationId);
  const hasLeftGroup =
    !!meta && meta.conversation.type === "group" && !meta.isMember;

  const submit = async () => {
    const content = value.trim();
    if (!content || !activeConversationId) return;
    setValue("");
    try {
      await sendMessage(content);
    } catch {
      setValue(content); // restore draft on failure
    }
  };

  return (
    <div className="shrink-0 border-t bg-background px-4 py-3">
      <form
        className="mx-auto flex w-full max-w-4xl items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={hasLeftGroup ? "You left this group" : "Type a message..."}
          aria-label="Type a message"
          className="h-10"
          disabled={hasLeftGroup}
        />
        <div className="relative"> 
          <button 
            type="button" 
            onClick={() => setShowEmojiPicker((prev) => !prev)} 
            className="p-2 text-xl hover:bg-gray-100 rounded-lg" 
            aria-label="Choose emoji" > 
              😊 
          </button> 
          {showEmojiPicker && ( 
            <div className="absolute bottom-12 right-0 z-50"> 
              <EmojiPicker onEmojiClick={handleEmojiClick} previewConfig={{ showPreview: false }}/> 
            </div> 
          )} 
        </div>
        <Button type="submit" size="icon" disabled={!value.trim() || hasLeftGroup}>
          <SendIcon />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}

/**
 * Compact member strip for group-chat headers: up to three member chips
 * inline, then a "+N more" affordance that opens a full members popover on click.
 *
 * When the signed-in user has left the group, the strip is replaced with a
 * muted “You left this group” chip.
 */
function ClubHashRow({
  conversation,
  isLeft,
  onLeave,
  onDelete,
  isCreator,
}: {
  conversation: Conversation;
  isLeft: boolean;
  onLeave: () => void;
  onDelete: () => void;
  isCreator: boolean;
}) {
  const members = conversation.participants;
  const allParticipants: Participant[] = [
    ...members,
    ...(conversation.formerMembers?.map((fm) => ({
      _id: fm._id,
      displayName: fm.displayName,
      avatarUrl: fm.avatarUrl ?? null,
      joinedAt: fm.leftAt,
    })) ?? []),
  ];
  const currentUserId = authStore((s) => s.user?._id);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Derived rather than synced with an effect: once the user has left, the
  // popover must never render, no matter what state it was last left in.
  const popoverVisible = popoverOpen && !isLeft;

  // Close the popover if the trigger scrolls out of view.
  useEffect(() => {
    if (!popoverOpen) return;

    const onScroll = () => setPopoverOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [popoverOpen]);

  if (!isLeft) {
    const inline = members.slice(0, 3);
    const overflow = members.length - 3;

    return (
      <div className="flex items-center gap-1">
        {inline.map((p) => (
          <MemberChip
            key={p._id}
            displayName={p.displayName}
            avatarUrl={p.avatarUrl}
          />
        ))}
        {overflow > 0 ? (
          <ClubHashPopover
            members={allParticipants}
            currentUserId={currentUserId ?? null}
            triggerRef={triggerRef}
            open={popoverVisible}
            onOpenChange={(v: boolean) => setPopoverOpen(v)}
            onLeave={onLeave}
            onDelete={onDelete}
            isCreator={isCreator}
          />
        ) : null}
      </div>
    );
  }

  return (
    <span className="text-xs text-muted-foreground">You left this group</span>
  );
}

interface MemberChipProps {
  displayName: string;
  avatarUrl?: string | null;
}

function MemberChip({ displayName, avatarUrl }: MemberChipProps) {
  return (
    <Avatar size="sm" className="-ml-1 ring-2 ring-sidebar ring-sidebar-border">
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt={displayName} />
      ) : null}
      <AvatarFallback>{initials(displayName) || "?"}</AvatarFallback>
    </Avatar>
  );
}

interface ClubHashPopoverProps {
  members: (Participant & { _id: string; displayName: string; avatarUrl?: string | null })[];
  currentUserId: string | null;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeave: () => void;
  onDelete: () => void;
  isCreator: boolean;
}

function ClubHashPopover({
  members,
  currentUserId,
  triggerRef,
  open,
  onOpenChange,
  onLeave,
  onDelete,
  isCreator,
}: ClubHashPopoverProps) {
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  // Anchor is measured in the click handler (a ref may not be read during
  // render, and `window` does not exist while server-rendering), then stored
  // as plain state so the portal can position itself.
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);

  const leaveIsPending = false; // leave/delete are async; busy state lives in ChatHeader

  const toggle = (next: boolean) => {
    if (next) {
      const rect = triggerRef.current?.getBoundingClientRect();
      setPopoverStyle(
        rect
          ? {
              top: Math.min(rect.bottom + 6, Math.max(12, window.innerHeight - 372)),
              left: Math.min(rect.left, Math.max(12, window.innerWidth - 272)),
            }
          : { top: 12, left: 16 }
      );
    }
    onOpenChange(next);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-label="Show group members"
        className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => toggle(!open)}
      >
        +{members.length - 3} more
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => onOpenChange(false)}
              />
              <div
                className="fixed z-50 w-64 rounded-xl border bg-popover p-1.5 shadow-lg"
                style={popoverStyle ?? undefined}
                role="dialog"
                aria-label="Group members"
              >
                <div className="flex items-center justify-between px-2 pb-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Members ({members.length})
                  </span>
                  {isCreator && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDeleteConfirm(true);
                        onOpenChange(false);
                      }}
                    >
                      <Trash2Icon className="size-3.5" />
                      <span className="ml-1 text-[11px]">Delete</span>
                    </Button>
                  )}
                </div>

                <ul className="flex flex-col gap-0.5">
                  {members.map((m) => {
                    const isMe = m._id === currentUserId;
                    return (
                      <li key={m._id}>
                        <div
                          className={"flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"}
                        >
                          <Avatar size="sm">
                            {m.avatarUrl ? (
                              <AvatarImage
                                src={m.avatarUrl}
                                alt={m.displayName}
                              />
                            ) : null}
                            <AvatarFallback>
                              {initials(m.displayName) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1 truncate">
                            {m.displayName}
                          </span>
                          {isMe && (
                            <span className="rounded-full bg-primary px-1.5 py-0 text-[10px] font-semibold text-primary-foreground">
                              you
                            </span>
                          )}
                          {isMe && !isCreator && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                              aria-label="Leave group"
                              onClick={() => {
                                setLeaveConfirm(true);
                                onOpenChange(false);
                              }}
                            >
                              <LogOutIcon className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>,
            document.body
          )
        : null}

      <ConfirmDialog
        open={leaveConfirm}
        onOpenChange={(open) => {
          if (!open) setLeaveConfirm(false);
          else {
            setLeaveConfirm(true);
            onOpenChange(true);
            return;
          }
        }}
        title="Leave this group?"
        description={`You will stop receiving new messages, but you can still read the old chat history.`}
        confirmLabel="Leave group"
        destructive
        submitting={leaveIsPending}
        onConfirm={() => {
          setLeaveConfirm(false);
          onLeave();
        }}
      />

      <ConfirmDialog
        open={deleteConfirm}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(false);
          else {
            setDeleteConfirm(true);
            onOpenChange(true);
            return;
          }
        }}
        title="Delete this group?"
        description={`"${members[0]?.displayName ?? "Group chat"}" and all of its messages will be permanently removed for every member.`}
        confirmLabel="Delete group"
        destructive
        submitting={leaveIsPending}
        onConfirm={() => {
          setDeleteConfirm(false);
          onDelete();
        }}
      />
    </>
  );
}
