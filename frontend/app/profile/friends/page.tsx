"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { friendStore } from "@/store/friendStore";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export default function FriendsPage() {
  const friends = friendStore((s) => s.friends);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    friendStore.getState().getFriends().finally(() => setLoading(false));
  }, []);

  return (
    <section className="rounded-2xl bg-card p-5 text-card-foreground shadow-sm">
      <h1 className="mb-4 text-lg font-semibold">
        Friends{!loading && friends.length > 0 ? ` (${friends.length})` : ""}
      </h1>

      {loading && friends.length === 0 ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : friends.length === 0 ? (
        <p className="text-sm text-muted-foreground">You have no friends yet.</p>
      ) : (
        <ul className="divide-y">
          {friends.map((friend) => (
            <li key={friend._id} className="flex items-center gap-3 py-3">
              <Avatar size="lg">
                {friend.avatarUrl ? <AvatarImage src={friend.avatarUrl} alt={friend.displayName} /> : null}
                <AvatarFallback>{friend.displayName?.[0]?.toUpperCase() || "U"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{friend.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">@{friend.username}</p>
              </div>
              {friend.friendsSince ? (
                <p className="shrink-0 text-xs text-muted-foreground">
                  Friends since {dateFormat.format(new Date(friend.friendsSince))}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
