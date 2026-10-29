import { create } from "zustand";
import { toast } from "sonner";
import type { Friend, FriendRequest } from "@/types/UserType";
import type { FriendState } from "@/types/SocketType";
import { friendService } from "@/server/friend";

/** Bộ đếm tăng dần để bỏ các response tìm kiếm về sai thứ tự. */
let searchSeq = 0;

export const friendStore = create<FriendState>()((set, get) => ({
  friends: [],
  loading: false,
  receivedList: [],
  sentList: [],
  searchResults: null,
  searchLoading: false,

  searchUsers: async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      searchSeq += 1;
      set({ searchResults: null, searchLoading: false });
      return;
    }

    const seq = ++searchSeq;
    set({ searchLoading: true });
    try {
      const users = await friendService.searchUsers(trimmed);
      // Bỏ qua response cũ (user vẫn gõ tiếp sau khi request này bắt đầu).
      if (seq !== searchSeq) return;
      set({ searchResults: users, searchLoading: false });
    } catch (error) {
      if (seq !== searchSeq) return;
      console.error("Error searching users:", error);
      set({ searchResults: [], searchLoading: false });
    }
  },

  clearSearch: () => set({ searchResults: null, searchLoading: false }),

  getFriends: async () => {
    try {
      const friends = await friendService.getFriends();
      set({ friends });
    } catch (error) {
      console.error("Error fetching friends:", error);
    }
  },

  getAllFriendRequests: async () => {
    try {
      set({ loading: true });
      const { sent, received } = await friendService.getAllFriendRequests();
      set({ sentList: sent, receivedList: received });
    } catch (error) {
      console.error("Error fetching friend requests:", error);
    } finally {
      set({ loading: false });
    }
  },

  addFriend: async (to: string, message?: string) => {
    try {
      const request = await friendService.addFriend(to, message);
      const exists = get().sentList.some((r) => r._id === request._id);
      if (!exists) {
        set((state) => ({ sentList: [request, ...state.sentList] }));
      }
      toast.success("Friend request sent");
      return request._id;
    } catch (error) {
      const apiMessage =
        error instanceof Error ? error.message : "Failed to send friend request";
      toast.error(apiMessage);
      throw error;
    }
  },

  acceptRequest: async (requestId: string) => {
    // Optimistic: xóa khỏi danh sách đã nhận, rollback nếu thất bại.
    const previous = get().receivedList;
    set((state) => ({
      receivedList: state.receivedList.filter((r) => r._id !== requestId),
    }));
    try {
      const { newFriend } = await friendService.acceptRequest(requestId);
      const exists = get().friends.some((f) => f._id === newFriend._id);
      if (!exists) {
        set((state) => ({ friends: [newFriend, ...state.friends] }));
      }
      toast.success("Friend request accepted");
    } catch (error) {
      set({ receivedList: previous });
      console.error("Error accepting friend request:", error);
      toast.error("Failed to accept friend request");
    }
  },

  declineRequest: async (requestId: string) => {
    const previous = get().receivedList;
    set((state) => ({
      receivedList: state.receivedList.filter((r) => r._id !== requestId),
    }));
    try {
      await friendService.declineRequest(requestId);
    } catch (error) {
      set({ receivedList: previous });
      console.error("Error declining friend request:", error);
      toast.error("Failed to decline friend request");
    }
  },

  receiveFriendRequest: (request: FriendRequest) => {
    const exists = get().receivedList.some((r) => r._id === request._id);
    if (exists) return;
    set((state) => ({
      receivedList: [request, ...state.receivedList],
    }));
    const senderName = request.from?.displayName ?? "Someone";
    toast.info(`${senderName} sent you a friend request`);
  },

  removeSentRequest: (requestId: string) => {
    set((state) => ({
      sentList: state.sentList.filter((r) => r._id !== requestId),
    }));
  },

  addFriendFromRequest: (friend: Friend) => {
    const exists = get().friends.some((f) => f._id === friend._id);
    if (exists) return;
    set((state) => ({ friends: [friend, ...state.friends] }));
  },

  resetFriends: () => {
    set({
      friends: [],
      receivedList: [],
      sentList: [],
      searchResults: null,
      searchLoading: false,
    });
  },
}));
