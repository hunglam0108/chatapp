"use client";

import { friendStore } from "@/store/friendStore";

/**
 * Friend request actions for the sidebar UI (search users, send/accept/decline
 * requests). State is read from friendStore selectors in the components.
 */
export function useFriends() {
  return {
    searchUsers: friendStore((s) => s.searchUsers),
    clearSearch: friendStore((s) => s.clearSearch),
    addFriend: friendStore((s) => s.addFriend),
    acceptRequest: friendStore((s) => s.acceptRequest),
    declineRequest: friendStore((s) => s.declineRequest),
  };
}
