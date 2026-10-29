export interface User {
  _id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  phone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Friend {
  _id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export interface FriendRequest {
  _id: string;
  from?: {
    _id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  to?: {
    _id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  message: string;
  createdAt: string;
  updatedAt: string;
}

/** Một kết quả của GET /user/search?query=... */
export interface SearchUser {
  _id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  /** Quan hệ giữa user được tìm và user hiện tại */
  relation: "self" | "friend" | "request_sent" | "request_received" | "none";
  /** Khi relation là request_sent/request_received: id của lời mời đang chờ đó */
  requestId?: string;
}