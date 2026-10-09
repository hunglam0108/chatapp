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

/** Result item of GET /user/search?query=... */
export interface SearchUser {
  _id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  /** Relationship between the searched user and the current user */
  relation: "self" | "friend" | "request_sent" | "request_received" | "none";
  /** When relation is request_sent/request_received, id of that pending request */
  requestId?: string;
}