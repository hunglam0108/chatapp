"use client";

import { useEffect } from "react";
import { chatStore } from "@/store/chatStore";
import { socketStore } from "@/store/socketStore";
import { friendStore } from "@/store/friendStore";
import { authStore } from "@/store/authStore";
import { emojiStore } from "@/store/emojiStore";

/**
 * Quản lý vòng đời kết nối socket cho user đã đăng nhập:
 * - kết nối socket một lần khi có access token
 * - load conversations, bạn bè và lời mời kết bạn đang chờ
 * - fetch lại danh sách sau khi kết nối lại (bù event bị lỡ khi offline)
 * - ngắt kết nối và xóa state khi đăng xuất
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
      emojiStore.getState().fetchEmojis();

      const s = socketStore.getState().socket;
      if (s) {
        const refetch = () => {
          chatStore.getState().fetchConversations();
          friendStore.getState().getFriends();
          friendStore.getState().getAllFriendRequests();
        };
        // Đồng bộ lại state từ server sau khi kết nối lại (có thể đã lỡ event).
        s.on("connect", refetch);
        return () => {
          s.off("connect", refetch);
        };
      }
    }
  }, [accessToken, user]);

  // Ngắt kết nối khi user đăng xuất.
  useEffect(() => {
    if (!accessToken) {
      socketStore.getState().disconnectSocket();
      chatStore.getState().reset();
      friendStore.getState().resetFriends();
      emojiStore.getState().reset();
    }
  }, [accessToken]);
}
