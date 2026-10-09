"use client";

import { useEffect } from "react";
import { chatStore } from "@/store/chatStore";
import { socketStore } from "@/store/socketStore";
import { friendStore } from "@/store/friendStore";
import { authStore } from "@/store/authStore";

/**
 * Owns the socket connection lifecycle for the signed-in user:
 * - connects the socket once when an access token exists
 * - loads conversations, friends and pending friend requests
 * - re-fetches lists after reconnection (missed events while offline)
 * - disconnects and clears state on sign-out
 */
export function useSocket() {
  const accessToken = authStore((s) => s.accessToken);
  const user = authStore((s) => s.user);

  useEffect(() => {
    if (!accessToken || !user) return;

    const { connectSocket, socket } = socketStore.getState();

    if (!socket) {
      connectSocket();

      chatStore.getState().fetchConversations();
      friendStore.getState().getFriends();
      friendStore.getState().getAllFriendRequests();

      const s = socketStore.getState().socket;
      if (s) {
        const refetch = () => {
          chatStore.getState().fetchConversations();
          friendStore.getState().getFriends();
          friendStore.getState().getAllFriendRequests();
        };
        // Re-sync server state after reconnecting (events may have been missed).
        s.on("connect", refetch);
        return () => {
          s.off("connect", refetch);
        };
      }
    }
  }, [accessToken, user]);

  // Disconnect when the user signs out.
  useEffect(() => {
    if (!accessToken) {
      socketStore.getState().disconnectSocket();
      chatStore.getState().reset();
      friendStore.getState().resetFriends();
    }
  }, [accessToken]);
}
