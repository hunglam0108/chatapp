import type { Socket } from "socket.io-client";
import { Conversation, Message } from "./ConversationType";
import { Friend, FriendRequest, SearchUser } from "./UserType";


export interface AuthState {
  accessToken: string | null;
  user: User | null;
  loading: boolean;

  setAccessToken: (accessToken: string) => void;
  setUser: (user: User) => void;
  clearState: () => void;
  signUp: (
    username: string,
    password: string,
    email: string,
    firstName: string,
    lastName: string
  ) => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchMe: () => Promise<void>;
  refresh: () => Promise<void>;
}

export interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (dark: boolean) => void;
}

export interface ChatState {
  conversations: Conversation[];
  messages: Record<
    string,
    {
      items: Message[];
      hasMore: boolean; // infinite-scroll
      nextCursor?: string | null; // phân trang
    }
  >;
  activeConversationId: string | null;
  convoLoading: boolean;
  messageLoading: boolean;
  loading: boolean;
  reset: () => void;

  setActiveConversation: (id: string | null) => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId?: string) => Promise<void>;
  sendDirectMessage: (
    recipientId: string,
    content: string,
    imgUrl?: string
  ) => Promise<void>;
  sendGroupMessage: (
    conversationId: string,
    content: string,
    imgUrl?: string
  ) => Promise<void>;
  // add message
  addMessage: (message: Message) => Promise<void>;
  // update convo
  updateConversation: (conversation: unknown) => void;
  /** Drop a conversation locally (used when a group is deleted). */
  removeConversation: (conversationId: string) => void;
  markAsSeen: () => Promise<void>;
  addConvo: (convo: Conversation) => void;
  createConversation: (
    type: "group" | "direct",
    name: string,
    memberIds: string[]
  ) => Promise<void>;
  /** Leave a group chat; old history stays visible, new messages stop. */
  leaveGroup: (conversationId: string) => Promise<void>;
  /** Delete a group chat (creator only). */
  deleteGroup: (conversationId: string) => Promise<void>;
}

export interface SocketState {
  socket: Socket | null;
  onlineUsers: string[];
  connectSocket: () => void;
  disconnectSocket: () => void;
}

export interface FriendState {
  friends: Friend[];
  loading: boolean;
  receivedList: FriendRequest[];
  sentList: FriendRequest[];
  searchResults: SearchUser[] | null;
  searchLoading: boolean;
  searchUsers: (query: string) => Promise<void>;
  clearSearch: () => void;
  addFriend: (to: string, message?: string) => Promise<string>;
  getAllFriendRequests: () => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  getFriends: () => Promise<void>;
  /** Called from socket handlers when someone sends us a request */
  receiveFriendRequest: (request: FriendRequest) => void;
  /** Called from socket handlers when a request of ours was accepted/declined */
  removeSentRequest: (requestId: string) => void;
  /** Called from socket handlers after we accept: adds the new friend */
  addFriendFromRequest: (friend: Friend) => void;
  resetFriends: () => void;
}

export interface UserState {
  updateAvatarUrl: (formData: FormData) => Promise<void>;
}