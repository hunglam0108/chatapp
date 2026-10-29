"use client";

import { friendStore } from "@/store/friendStore";

/**
 * Các action lời mời kết bạn cho UI sidebar (tìm user, gửi/chấp nhận/từ chối
 * lời mời). State được đọc qua selector của friendStore trong component.
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
