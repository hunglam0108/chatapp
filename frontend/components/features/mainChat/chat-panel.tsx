"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { EmojiClickData } from "emoji-picker-react";
import {
  FileIcon,
  ImagePlusIcon,
  Loader2Icon,
  LogOutIcon,
  MicIcon,
  PaletteIcon,
  PanelLeftIcon,
  PencilIcon,
  SendIcon,
  SquareIcon,
  Trash2Icon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import {
  MAX_FILE_BYTES,
  formatBytes,
  uploadFile,
} from "@/server/upload";
import { toast } from "sonner";
import type { MessageAttachments } from "@/server/chat";
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
import { emojiStore } from "@/store/emojiStore";
import {
  DEFAULT_QUICK_EMOJI,
  chatThemeStyle,
  isEmojiOnly,
} from "@/lib/chat-themes";
import { EmojiPicker } from "./emoji-picker";
import { ReactionChips, ReactionPicker } from "./message-reactions";
import { ChatSettingsDialog } from "./chat-settings-dialog";
import { CustomEmojiCreator, MAX_CUSTOM_EMOJIS } from "./custom-emoji-creator";

// --- helper nội bộ -------------------------------------------------------------------

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

// Giữ đồng bộ với EDIT_WINDOW_MS trong messageController ở backend.
const EDIT_WINDOW_MS = 15 * 60 * 1000;
// Tin nhắn liên tiếp cùng người gửi cách nhau dưới mốc này chỉ hiện time ở tin cuối.
const TIME_GROUP_MS = 5 * 60 * 1000;

const messageActionClass =
  "shrink-0 self-center rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-60";

function MessageRow({
  message,
  showAvatar,
  showTime,
  isGroup,
  sender,
  canReact,
}: {
  message: Message;
  showAvatar: boolean;
  showTime: boolean;
  isGroup: boolean;
  sender?: { displayName: string; avatarUrl?: string | null };
  canReact: boolean;
}) {
  const currentUserId = authStore((s) => s.user?._id);
  const isOwn =
    message.isOwn ??
    Boolean(currentUserId && String(message.senderId) === String(currentUserId));

  const senderName = sender?.displayName || (isOwn ? "You" : "User");
  const hasAttachment = !!(message.imgUrl || message.audioUrl || message.fileUrl);
  // Sticker và text chỉ có emoji được hiển thị lớn, không có bubble, giống Messenger.
  const bare = !!message.stickerUrl || (!hasAttachment && isEmojiOnly(message.content));

  const [draft, setDraft] = useState<string | null>(null);
  const [confirmRecall, setConfirmRecall] = useState(false);
  const [busy, setBusy] = useState(false);

  const recalled = !!message.recalledAt;
  const canReactHere = canReact && !recalled;
  const canEdit = isOwn && canReactHere && !!message.content && !message.stickerUrl;

  const react = (emoji: string) => {
    chatStore
      .getState()
      .toggleReaction(message._id, emoji)
      .catch(() => toast.error("Could not react to this message"));
  };

  const startEdit = () => {
    if (Date.now() - new Date(message.createdAt).getTime() > EDIT_WINDOW_MS) {
      toast.error("Messages can only be edited within 15 minutes");
      return;
    }
    setDraft(message.content ?? "");
  };

  const saveEdit = async () => {
    const content = draft?.trim();
    if (!content || content === message.content) {
      setDraft(null);
      return;
    }
    setBusy(true);
    try {
      await chatStore.getState().editMessage(message._id, content);
      setDraft(null);
    } catch {
      toast.error("Could not edit this message");
    } finally {
      setBusy(false);
    }
  };

  const recall = async () => {
    setBusy(true);
    try {
      await chatStore.getState().recallMessage(message._id);
      setConfirmRecall(false);
    } catch {
      toast.error("Could not unsend this message");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "group flex w-full gap-2",
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
      {isOwn && canReactHere ? (
        <>
          <button
            type="button"
            aria-label="Unsend message"
            title="Unsend"
            className={cn(messageActionClass, "hover:text-destructive")}
            onClick={() => setConfirmRecall(true)}
          >
            <Undo2Icon className="size-4" />
          </button>
          {canEdit ? (
            <button
              type="button"
              aria-label="Edit message"
              title="Edit"
              className={messageActionClass}
              onClick={startEdit}
            >
              <PencilIcon className="size-4" />
            </button>
          ) : null}
          <ReactionPicker align="end" onPick={react} />
        </>
      ) : null}
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
            bare
              ? "flex flex-col"
              : "rounded-2xl px-3.5 py-2 text-sm shadow-xs",
            bare && isOwn && "items-end",
            !bare &&
              (isOwn
                ? "rounded-br-xs bg-(--chat-bubble) text-(--chat-bubble-foreground)"
                : "rounded-bl-xs bg-muted text-foreground dark:bg-[color-mix(in_oklch,var(--chat-bubble)_28%,var(--secondary))]")
          )}
        >
          {recalled ? (
            <p className="italic leading-relaxed opacity-70">Message unsent</p>
          ) : null}
          {message.stickerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.stickerUrl}
              alt="Sticker"
              className="size-24 object-contain"
            />
          ) : null}
          {draft !== null ? (
            <div className="flex flex-col gap-1">
              <Input
                autoFocus
                value={draft}
                disabled={busy}
                aria-label="Edit message"
                className="h-8 min-w-48 bg-background text-foreground"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveEdit();
                  } else if (e.key === "Escape") {
                    setDraft(null);
                  }
                }}
              />
              <span className="text-[10px] opacity-75">Enter to save · Esc to cancel</span>
            </div>
          ) : message.content ? (
            <p
              className={cn(
                "break-words whitespace-pre-wrap",
                bare ? "text-4xl leading-tight" : "leading-relaxed"
              )}
            >
              {message.content}
            </p>
          ) : null}
          {message.imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.imgUrl}
              alt="Attachment"
              className="mt-1.5 max-h-64 rounded-lg object-contain"
              onClick={() => window.open(message.imgUrl!, "_blank")}
              style={{ cursor: "zoom-in" }}
            />
          ) : null}
          {message.audioUrl ? (
            <audio
              controls
              src={message.audioUrl}
              className="mt-1.5 h-9 max-w-56"
              preload="metadata"
            />
          ) : null}
          {message.fileUrl ? (
            <a
              href={message.fileUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "mt-1.5 flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs",
                isOwn
                  ? "border-primary-foreground/25 bg-primary-foreground/10 hover:bg-primary-foreground/20"
                  : "border-border bg-background hover:bg-accent"
              )}
            >
              <FileIcon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate font-medium">
                {message.fileMeta?.name || "Attachment"}
              </span>
              {message.fileMeta?.size ? (
                <span className="shrink-0 opacity-70">
                  {formatBytes(message.fileMeta.size)}
                </span>
              ) : null}
            </a>
          ) : null}
          {showTime || (message.editedAt && !recalled) ? (
            <p
              className={cn(
                "mt-1 text-[9px]",
                bare
                  ? "text-muted-foreground"
                  : isOwn
                    ? "text-(--chat-bubble-foreground)/75 text-right"
                    : "text-muted-foreground"
              )}
            >
              {showTime ? timeLabel(message.createdAt) : ""}
              {message.editedAt && !recalled ? `${showTime ? " · " : ""}edited` : ""}
            </p>
          ) : null}
        </div>
        <ReactionChips
          reactions={message.reactions ?? []}
          currentUserId={currentUserId}
          disabled={!canReactHere}
          onToggle={react}
        />
      </div>
      {!isOwn && canReactHere ? <ReactionPicker align="start" onPick={react} /> : null}
      <ConfirmDialog
        open={confirmRecall}
        onOpenChange={(open) => !busy && setConfirmRecall(open)}
        title="Unsend this message?"
        description="The message and its attachments will be removed for everyone in this chat."
        confirmLabel="Unsend"
        destructive
        submitting={busy}
        onConfirm={() => void recall()}
      />
    </div>
  );
}

/**
 * Vùng chat chính: header + danh sách tin nhắn cuộn được + composer, xếp trong
 * flex column lấp đầy SidebarInset. Danh sách cuộn còn header
 * và composer cố định (min-h-0 cho phép danh sách co lại thay vì đẩy
 * composer ra ngoài màn hình).
 */
export function ChatPanel() {
  const activeConversationId = chatStore((s) => s.activeConversationId);
  const theme = chatStore((s) =>
    s.conversations.find((c) => c._id === s.activeConversationId)?.theme
  );

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col bg-background"
      style={chatThemeStyle(theme)}
    >
      <ChatHeader />
      <MessageList />
      {activeConversationId ? <MessageComposer /> : null}
    </div>
  );
}

// Cache cấp module map userId -> thông tin participant, lấy từ
// conversation đang mở. Tránh prop drilling participants qua từng dòng tin nhắn.
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
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        <Button
          variant="ghost"
          size="icon"
          aria-label="Chat settings"
          title="Theme & emoji"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setSettingsOpen(true)}
        >
          <PaletteIcon />
        </Button>
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

      <ChatSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        conversation={conversation}
        canEdit={meta.isMember}
      />
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

  // Giữ cache người gửi của group chat đồng bộ với thành viên conversation.
  // Bao gồm cả thành viên cũ để tin nhắn cũ vẫn giữ tên người gửi.
  useEffect(() => {
    if (!meta) return;
    meta.conversation.participants.forEach((p) => {
      senderCache.set(p._id, { displayName: p.displayName, avatarUrl: p.avatarUrl });
    });
    (meta.conversation.formerMembers ?? []).forEach((fm) => {
      senderCache.set(fm._id, { displayName: fm.displayName, avatarUrl: fm.avatarUrl });
    });
  }, [meta]);

  // Tự động cuộn tới tin nhắn mới nhất.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items.length]);

  if (!activeConversationId) {
    return (
      <div className="relative flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
        {/* Header chat (và nút mở sidebar) bị ẩn cho tới khi có
            conversation được chọn, nên empty state cần trigger riêng
            nếu không sẽ không mở được sidebar trên màn hình nhỏ. */}
        {isMobile ? (
          <SidebarTrigger className="absolute left-2 top-2" />
        ) : null}
        <PanelLeftIcon className="size-8" />
        <p className="text-sm">Select a chat to start messaging</p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-4"
      style={{ backgroundImage: "var(--chat-background)" }}
    >
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
          const next = items[index + 1];
          const showTime =
            !next ||
            next.senderId !== message.senderId ||
            new Date(next.createdAt).getTime() - new Date(message.createdAt).getTime() >
              TIME_GROUP_MS;
          return (
            <MessageRow
              key={message._id}
              message={message}
              showAvatar={showAvatar}
              showTime={showTime}
              isGroup={meta?.conversation.type === "group"}
              canReact={!!meta?.isMember}
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
  // Đính kèm đang chờ (đã upload, chờ gửi cùng tin nhắn tiếp theo).
  const [attachment, setAttachment] = useState<MessageAttachments | null>(null);
  const [attaching, setAttaching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // State ghi âm (MediaRecorder).
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleEmojiClick = (emojiData: EmojiClickData) => { 
    if (emojiData.isCustom) {
      setShowEmojiPicker(false);
      sendMessage("", { stickerUrl: emojiData.imageUrl }).catch(() =>
        toast.error("Could not send the sticker. Try again!")
      );
      return;
    }
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
  const quickEmoji = meta?.conversation.quickEmoji ?? DEFAULT_QUICK_EMOJI;
  const customEmojis = emojiStore((s) => s.emojis);
  const emojiFileInputRef = useRef<HTMLInputElement>(null);

  const openCreateEmoji = () => {
    if (customEmojis.length >= MAX_CUSTOM_EMOJIS) {
      toast.error(`You can have up to ${MAX_CUSTOM_EMOJIS} custom emojis`);
      return;
    }
    emojiFileInputRef.current?.click();
  };

  const submit = async () => {
    const content = value.trim();
    if ((!content && !attachment) || !activeConversationId) return;
    setValue("");
    const pending = attachment;
    setAttachment(null);
    try {
      await sendMessage(content, pending ?? undefined);
    } catch {
      setValue(content); // khôi phục bản nháp khi thất bại
      setAttachment(pending);
    }
  };

  /** Chọn + upload file (ảnh hoặc file thường, ≤10MB), đính kèm vào tin nhắn tiếp theo. */
  const handleFilePicked = async (file: File | undefined) => {
    if (!file || attaching) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error(
        `File is too large. Max ${formatBytes(MAX_FILE_BYTES)}, got ${formatBytes(file.size)}`
      );
      return;
    }
    setAttaching(true);
    try {
      const result = await uploadFile(file);
      setAttachment(
        result.kind === "image"
          ? { imgUrl: result.url }
          : { fileUrl: result.url, fileMeta: { name: result.originalname || result.filename, size: result.size, mimetype: result.mimetype } }
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed. Try again!");
    } finally {
      setAttaching(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopRecording = (send: boolean) => {
    const recorder = recorderRef.current;
    stopTimer();
    setRecording(false);
    setRecordSeconds(0);
    if (!recorder) return;
    recorderRef.current = null;
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      chunksRef.current = [];
      if (!send || blob.size === 0) return;
      if (blob.size > MAX_FILE_BYTES) {
        toast.error("Voice note is too large (max 10 MB)");
        return;
      }
      const ext = recorder.mimeType?.includes("ogg") ? "ogg" : "webm";
      const file = new File([blob], `voice-note.${ext}`, { type: blob.type });
      setAttaching(true);
      try {
        const result = await uploadFile(file);
        // Voice note được gửi ngay thay vì xếp hàng làm
        // đính kèm, để hai voice note không ghi đè nhau.
        await sendMessage("", { audioUrl: result.url });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not send the voice note. Try again!");
      } finally {
        setAttaching(false);
      }
    };
    recorder.stop();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => stream.getTracks().forEach((t) => t.stop());
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          // Giới hạn cứng 10 MB audio (~5 phút webm/opus).
          if (s >= 300) {
            stopRecording(true);
            return 0;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      toast.error("Microphone access was denied");
    }
  };

  const canSend = (!!value.trim() || !!attachment) && !hasLeftGroup;

  return (
    <div className="shrink-0 border-t bg-background px-4 py-3">
      <form
        className="mx-auto flex w-full max-w-4xl flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {recording ? (
          <div className="flex h-10 items-center gap-3 rounded-md border bg-muted/50 px-3">
            <span className="size-2.5 animate-pulse rounded-full bg-destructive" />
            <span className="text-sm font-medium tabular-nums">
              Recording {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, "0")}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                aria-label="Discard voice note"
                onClick={() => stopRecording(false)}
              >
                <Trash2Icon className="size-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                aria-label="Send voice note"
                onClick={() => stopRecording(true)}
              >
                <SendIcon className="size-4" />
                <span className="sr-only">Send voice note</span>
              </Button>
            </div>
          </div>
        ) : null}

        {attachment && !recording ? (
          <div className="flex h-10 items-center gap-2 rounded-md border bg-muted/50 px-3">
            <ImagePlusIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {attachment.imgUrl
                ? "Image attached"
                : attachment.fileMeta?.name
                  ? `${attachment.fileMeta.name} (${formatBytes(attachment.fileMeta.size)})`
                  : "File attached"}
            </span>
            <button
              type="button"
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive"
              aria-label="Remove attachment"
              onClick={() => setAttachment(null)}
            >
              <XIcon className="size-4" />
            </button>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,audio/*,video/*"
            onChange={(e) => void handleFilePicked(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Attach image or file"
            title="Attach image or file (max 10MB)"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            disabled={hasLeftGroup || attaching || recording}
            onClick={() => fileInputRef.current?.click()}
          >
            {attaching ? <Loader2Icon className="animate-spin" /> : <ImagePlusIcon />}
          </Button>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              hasLeftGroup
                ? "You left this group"
                : recording
                  ? "Recording voice note..."
                  : "Type a message..."
            }
            aria-label="Type a message"
            className="h-10"
            disabled={hasLeftGroup || recording}
          />
          <div className="relative"> 
            <button 
              type="button" 
              onClick={() => setShowEmojiPicker((prev) => !prev)} 
              className="p-2 text-xl hover:bg-muted rounded-lg" 
              aria-label="Choose emoji" > 
                😊 
            </button> 
            {showEmojiPicker && ( 
              <div className="absolute bottom-12 right-0 z-50 flex flex-col gap-2"> 
                <CustomEmojiCreator inputRef={emojiFileInputRef} />
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  onCreateEmoji={openCreateEmoji}
                  customEmojis={customEmojis.map((e) => ({
                    id: e._id,
                    names: [e.name],
                    imgUrl: e.imgUrl,
                  }))}
                /> 
              </div> 
            )} 
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={recording ? "Stop recording" : "Record voice note"}
            title="Record a voice note"
            className={cn(
              "shrink-0 text-muted-foreground hover:text-foreground",
              recording && "text-destructive hover:text-destructive"
            )}
            disabled={hasLeftGroup || !!attachment}
            onClick={() => (recording ? stopRecording(true) : void startRecording())}
          >
            {recording ? <SquareIcon /> : <MicIcon />}
          </Button>
          {canSend || attaching || recording ? (
            <Button type="submit" size="icon" disabled={!canSend || attaching}>
              <SendIcon />
              <span className="sr-only">Send</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-2xl"
              aria-label={`Send ${quickEmoji}`}
              title={`Send ${quickEmoji}`}
              disabled={hasLeftGroup}
              onClick={() =>
                sendMessage(quickEmoji).catch(() =>
                  toast.error("Could not send the message. Try again!")
                )
              }
            >
              {quickEmoji}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

/**
 * Dải thành viên gọn cho header group chat: tối đa ba chip thành viên
 * inline, kèm nút "+N more" mở popover đầy đủ danh sách thành viên khi click.
 *
 * Khi user đã rời nhóm, dải này được thay bằng
 * chip mờ “You left this group”.
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

  // Tính trực tiếp thay vì đồng bộ bằng effect: khi user đã rời nhóm,
  // popover không bao giờ được render, bất kể state trước đó.
  const popoverVisible = popoverOpen && !isLeft;

  // Đóng popover nếu trigger bị cuộn ra khỏi tầm nhìn.
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
  // Vị trí neo được đo trong click handler (không được đọc ref trong lúc
  // render, và `window` không tồn tại khi render phía server), rồi lưu
  // thành state thường để portal tự định vị.
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);

  const leaveIsPending = false; // leave/delete là async; trạng thái busy nằm ở ChatHeader

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
