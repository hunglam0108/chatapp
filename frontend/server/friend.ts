import type { Friend, FriendRequest, SearchUser } from "@/types/UserType";
import { api } from "./api";

export const friendService = {
  /** GET /user/search?query=xxx — tìm user theo username hoặc tên hiển thị */
  async searchUsers(query: string): Promise<SearchUser[]> {
    const res = await api.get<{ users: SearchUser[] }>(
      `/user/search?query=${encodeURIComponent(query)}`
    );
    return res.users ?? [];
  },

  async getFriends(): Promise<Friend[]> {
    const res = await api.get<{ friends: Friend[] }>("/friends");
    return res.friends ?? [];
  },

  async getAllFriendRequests(): Promise<{
    sent: FriendRequest[];
    received: FriendRequest[];
  }> {
    const res = await api.get<{ sent: FriendRequest[]; received: FriendRequest[] }>(
      "/friends/requests"
    );
    return { sent: res.sent ?? [], received: res.received ?? [] };
  },

  /** POST /friends/requests — trả về lời mời vừa tạo (hoặc lời mời đã có) */
  async addFriend(to: string, message?: string): Promise<FriendRequest> {
    const res = await api.post<{ request: FriendRequest }>("/friends/requests", {
      to,
      message,
    });
    return res.request;
  },

  async acceptRequest(
    requestId: string
  ): Promise<{ newFriend: Friend }> {
    const res = await api.post<{
      message: string;
      newFriend: Friend;
    }>(`/friends/requests/${requestId}/accept`);
    return res;
  },

  async declineRequest(requestId: string): Promise<void> {
    await api.post(`/friends/requests/${requestId}/decline`);
  },
};
