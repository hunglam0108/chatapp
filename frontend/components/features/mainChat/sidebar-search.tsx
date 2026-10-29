"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2Icon, SearchIcon, UserPlusIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MascotWidget } from "./mascot-widget";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { friendStore } from "@/store/friendStore";
import { useFriends } from "@/hooks/use-friends";
import type { SearchUser } from "@/types/UserType";

function RelationBadge({ relation }: { relation: SearchUser["relation"] }) {
  switch (relation) {
    case "friend":
      return (
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
          Friend
        </span>
      );
    case "request_sent":
      return (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          Request sent
        </span>
      );
    case "request_received":
      return (
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
          They invited you
        </span>
      );
    default:
      return null;
  }
}

function SearchRow({ user }: { user: SearchUser }) {
  const addFriend = useFriends().addFriend;
  const [sending, setSending] = useState(false);

  const canSend =
    user.relation === "none" ||
    (user.relation === "request_received" && user.requestId);

  const handleAdd = async () => {
    setSending(true);
    try {
      if (user.relation === "request_received" && user.requestId) {
        // User kia đã mời mình rồi — chấp nhận lời mời đó thay vì gửi mới.
        await friendStore.getState().acceptRequest(user.requestId);
      } else {
        await addFriend(user._id);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <li className="flex items-center gap-3 px-2 py-2">
      <Avatar>
        {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.displayName} /> : null}
        <AvatarFallback>{user.displayName?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
      </Avatar>
      <div className="grid min-w-0 flex-1 leading-tight">
        <span className="truncate text-sm font-medium">{user.displayName}</span>
        <span className="truncate text-xs text-muted-foreground">@{user.username}</span>
      </div>
      <RelationBadge relation={user.relation} />
      {canSend ? (
        <Button
          size="sm"
          variant="outline"
          disabled={sending}
          onClick={handleAdd}
          className="shrink-0"
        >
          {sending ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <UserPlusIcon className="size-3.5" />
          )}
          Add friend
        </Button>
      ) : null}
    </li>
  );
}

/**
 * Ô tìm kiếm ở header sidebar: tìm bạn theo từ khóa (có debounce, tìm
 * bằng regex phía server trên username/displayName) và cho phép gửi lời mời kết bạn
 * ngay từ kết quả.
 */
export function SidebarSearch() {
  const searchUsers = useFriends().searchUsers;
  const clearSearch = useFriends().clearSearch;
  const searchResults = friendStore((s) => s.searchResults);
  const searchLoading = friendStore((s) => s.searchLoading);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce input trước khi gọi API tìm kiếm.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebounced(query.trim()), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Gọi tìm kiếm khi giá trị đã debounce thay đổi.
  useEffect(() => {
    if (!debounced) {
      clearSearch();
      return;
    }
    void searchUsers(debounced);
  }, [debounced, searchUsers, clearSearch]);

  const hasQuery = debounced.length > 0;
  const showResults = hasQuery && (searchLoading || searchResults !== null);

  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [panelPos, setPanelPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // Neo panel kết quả bên dưới ô tìm kiếm, nhưng cho phép rộng hơn
  // sidebar (sidebar cố định 16rem và nội dung bị cắt khi
  // tràn, nên panel phải render qua portal để mở rộng).
  useEffect(() => {
    if (!showResults) {
      setPanelPos(null);
      return;
    }
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return; // input bị ẩn (chế độ icon)
    setPanelPos({
      top: rect.bottom + 6,
      left: rect.left,
    });
  }, [showResults]);

  // Giữ panel bám theo input khi window hoặc sidebar đổi kích thước.
  useEffect(() => {
    if (!panelPos) return;
    const onMove = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) {
        setPanelPos(null);
        return;
      }
      setPanelPos({ top: rect.bottom + 6, left: rect.left });
    };
    window.addEventListener("resize", onMove);
    return () => window.removeEventListener("resize", onMove);
  }, [panelPos]);

  // Panel nổi trên trang nên đóng nó khi click ra ngoài.
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!showResults) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setQuery("");
      clearSearch();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showResults, clearSearch]);

  const resultsPanel = showResults ? (
    <div
      ref={panelRef}
      className="fixed z-50 w-96 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border bg-popover shadow-md"
      style={
        panelPos
          ? {
              top: panelPos.top,
              left: Math.max(
                8,
                Math.min(panelPos.left, window.innerWidth - 392)
              ),
            }
          : { display: "none" }
      }
    >
      <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
        Search results
      </p>
      {searchLoading && !searchResults ? (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" /> Searching...
        </div>
      ) : null}
      <ul className="max-h-72 overflow-y-auto p-1">
        {searchResults && searchResults.length > 0 ? (
          searchResults.map((user) => <SearchRow key={user._id} user={user} />)
        ) : !searchLoading ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            No matching users found
          </li>
        ) : null}
      </ul>
    </div>
  ) : null;

  return (
    <div className="px-2 group-data-[collapsible=icon]:px-0">
      <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
        <div
          ref={anchorRef}
          className="relative min-w-0 flex-1 group-data-[collapsible=icon]:hidden"
        >
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search friends, messages..."
            className="h-9 bg-background pl-8"
            aria-label="Search"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setQuery("");
                clearSearch();
              }}
            >
              <XIcon className="size-4" />
            </button>
          ) : null}
        </div>
        <MascotWidget />
      </div>

      {typeof document !== "undefined"
        ? resultsPanel
          ? createPortal(resultsPanel, document.body)
          : null
        : resultsPanel}
    </div>
  );
}
