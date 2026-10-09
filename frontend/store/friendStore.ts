import { create } from "zustand";
import { toast } from "sonner";
import type { Friend, FriendRequest } from "@/types/UserType";
import type { FriendState } from "@/types/SocketType";
import { friendService } from "@/server/friend";

/** Monotonic counter to discard out-of-order search responses. */
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
      // Ignore stale responses (user kept typing after this request started).
      if (seq !== searchSeq) return;
      set({ searchResults: users, searchLoading: false });
    } catch (error) {
      if (seq !== searchSeq) return;
      console.error("Lỗi khi tìm kiếm người dùng:", error);
      set({ searchResults: [], searchLoading: false });
    }
  },

  clearSearch: () => set({ searchResults: null, searchLoading: false }),

  getFriends: async () => {
    try {
      const friends = await friendService.getFriends();
      set({ friends });
    } catch (error) {
      console.error("Lỗi khi lấy danh sách bạn bè:", error);
    }
  },

  getAllFriendRequests: async () => {
    try {
      set({ loading: true });
      const { sent, received } = await friendService.getAllFriendRequests();
      set({ sentList: sent, receivedList: received });
    } catch (error) {
      console.error("Lỗi khi lấy lời mời kết bạn:", error);
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
      toast.success("Đã gửi lời mời kết bạn");
      return request._id;
    } catch (error) {
      const apiMessage =
        error instanceof Error ? error.message : "Gửi lời mời kết bạn thất bại";
      toast.error(apiMessage);
      throw error;
    }
  },

  acceptRequest: async (requestId: string) => {
    // Optimistic: remove from received list, roll back on failure.
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
      toast.success("Chấp nhận lời mời kết bạn thành công");
    } catch (error) {
      set({ receivedList: previous });
      console.error("Lỗi khi chấp nhận lời mời kết bạn:", error);
      toast.error("Chấp nhận lời mời kết bạn thất bại");
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
      console.error("Lỗi khi từ chối lời mời kết bạn:", error);
      toast.error("Từ chối lời mời kết bạn thất bại");
    }
  },

  receiveFriendRequest: (request: FriendRequest) => {
    const exists = get().receivedList.some((r) => r._id === request._id);
    if (exists) return;
    set((state) => ({
      receivedList: [request, ...state.receivedList],
    }));
    const senderName = request.from?.displayName ?? "ai đó";
    toast.info(`${senderName} đã gửi lời mời kết bạn`);
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
