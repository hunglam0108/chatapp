"use client";

import { useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { friendStore } from "@/store/friendStore";
import { useFriends } from "@/hooks/use-friends";

function RequestRow({ requestId }: { requestId: string }) {
  const request = friendStore((s) =>
    s.receivedList.find((r) => r._id === requestId)
  );
  const { acceptRequest, declineRequest } = useFriends();
  const [busy, setBusy] = useState(false);

  const from = request?.from;

  return (
    <SidebarMenuItem>
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
        <Avatar size="sm">
          {from?.avatarUrl ? (
            <AvatarImage src={from.avatarUrl} alt={from.displayName} />
          ) : null}
          <AvatarFallback>{from?.displayName?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
        </Avatar>
        <div className="grid min-w-0 flex-1 leading-tight">
          <span className="truncate text-sm font-medium">
            {from?.displayName ?? "User"}
          </span>
          {request?.message ? (
            <span className="truncate text-xs text-muted-foreground">
              “{request.message}”
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            size="icon-xs"
            variant="outline"
            aria-label="Accept"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await acceptRequest(requestId);
              } finally {
                setBusy(false);
              }
            }}
          >
            <CheckIcon className="size-3.5" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Decline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await declineRequest(requestId);
              } finally {
                setBusy(false);
              }
            }}
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </SidebarMenuItem>
  );
}

/** Lời mời kết bạn đã nhận, kèm nút chấp nhận/từ chối inline. */
export function FriendRequests() {
  const receivedList = friendStore((s) => s.receivedList);

  if (receivedList.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        Friend requests ({receivedList.length})
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {receivedList.map((request) => (
            <RequestRow key={request._id} requestId={request._id} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
