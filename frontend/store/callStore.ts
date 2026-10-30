import { create } from "zustand";
import { toast } from "sonner";
import { socketStore } from "./socketStore";
import type { CallEndReason, CallSignalPayload, CallState } from "@/types/SocketType";

// shortcut: TURN credential tĩnh lấy từ env (lộ ra client); production nên cấp credential tạm thời từ backend.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  ...(process.env.NEXT_PUBLIC_TURN_URL
    ? [
        {
          urls: process.env.NEXT_PUBLIC_TURN_URL,
          username: process.env.NEXT_PUBLIC_TURN_USERNAME,
          credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
        },
      ]
    : []),
];

const INVITE_ERRORS: Record<string, string> = {
  busy: "User is in another call",
  offline: "User is offline",
  forbidden: "You can't call this conversation",
};

const END_MESSAGES: Partial<Record<CallEndReason, string>> = {
  declined: "Call declined",
  "no-answer": "No answer",
  cancelled: "Missed call",
  ended: "Call ended",
  disconnected: "Call dropped",
};

const initialState = {
  status: "idle" as const,
  callId: null,
  conversationId: null,
  peer: null,
  video: false,
  localStream: null,
  remoteStream: null,
  micOn: true,
  camOn: false,
  connectedAt: null,
};

// RTCPeerConnection không cần render nên để ngoài store.
let pc: RTCPeerConnection | null = null;
// Xử lý signal tuần tự: ICE candidate không được chạy trước setRemoteDescription.
let signalChain: Promise<void> = Promise.resolve();
// Tăng mỗi lần dọn call, để bước async cũ (xin quyền, chờ ack) biết call đã bị huỷ.
let session = 0;

const getMedia = async (video: boolean) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Calls need HTTPS and a browser with camera/mic support");
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true, video });
  } catch (error) {
    if (!video) throw error;
    toast.info("Camera unavailable, continuing with voice only");
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }
};

const mediaErrorMessage = (error: unknown) =>
  error instanceof DOMException && error.name === "NotAllowedError"
    ? "Microphone/camera permission denied"
    : error instanceof Error
      ? error.message
      : "Could not access microphone/camera";

const sendSignal = (callId: string, data: CallSignalPayload["data"]) => {
  socketStore.getState().socket?.emit("call:signal", { callId, data });
};

export const callStore = create<CallState>((set, get) => {
  const cleanup = () => {
    session++;
    pc?.close();
    pc = null;
    signalChain = Promise.resolve();
    get().localStream?.getTracks().forEach((t) => t.stop());
    set(initialState);
  };

  const fail = (message: string) => {
    toast.error(message);
    get().hangup();
  };

  const createPeer = (callId: string, stream: MediaStream) => {
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peer.onicecandidate = (e) => {
      if (e.candidate) sendSignal(callId, { candidate: e.candidate.toJSON() });
    };
    peer.ontrack = (e) => set({ remoteStream: e.streams[0] ?? null });
    peer.onconnectionstatechange = () => {
      if (pc !== peer) return;
      if (peer.connectionState === "connected" && get().status !== "active") {
        set({ status: "active", connectedAt: Date.now() });
      } else if (peer.connectionState === "failed") {
        fail("Connection failed");
      }
    };
    stream.getTracks().forEach((t) => peer.addTrack(t, stream));
    pc = peer;
    return peer;
  };

  return {
    ...initialState,

    startCall: async (conversationId, peer, video) => {
      const socket = socketStore.getState().socket;
      if (get().status !== "idle") return;
      if (!socket?.connected) {
        toast.error("Not connected to the server");
        return;
      }

      set({ status: "outgoing", conversationId, peer, video });
      const current = session;

      let stream: MediaStream;
      try {
        stream = await getMedia(video);
      } catch (error) {
        if (current === session) cleanup();
        toast.error(mediaErrorMessage(error));
        return;
      }
      if (current !== session) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      set({ localStream: stream, camOn: stream.getVideoTracks().length > 0 });

      let res: { callId?: string; error?: string };
      try {
        res = await socket.timeout(10_000).emitWithAck("call:invite", { conversationId, video });
      } catch {
        res = { error: "server" };
      }
      if (current !== session) {
        // User đã huỷ trong lúc chờ server: kết thúc call vừa được tạo.
        if (res.callId) socket.emit("call:end", { callId: res.callId });
        return;
      }
      if (!res.callId) {
        cleanup();
        toast.error(INVITE_ERRORS[res.error ?? ""] ?? "Could not start the call");
        return;
      }
      set({ callId: res.callId });
    },

    accept: async () => {
      const { status, callId, video } = get();
      if (status !== "incoming" || !callId) return;

      set({ status: "connecting" });
      const current = session;
      let stream: MediaStream;
      try {
        stream = await getMedia(video);
      } catch (error) {
        toast.error(mediaErrorMessage(error));
        if (current === session) get().decline();
        return;
      }
      if (current !== session) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      set({ localStream: stream, camOn: stream.getVideoTracks().length > 0 });
      createPeer(callId, stream);
      socketStore.getState().socket?.emit("call:accept", { callId });
    },

    decline: () => {
      const { callId } = get();
      if (callId) socketStore.getState().socket?.emit("call:decline", { callId });
      cleanup();
    },

    hangup: () => {
      const { callId } = get();
      if (callId) socketStore.getState().socket?.emit("call:end", { callId });
      cleanup();
    },

    toggleMic: () => {
      const micOn = !get().micOn;
      get().localStream?.getAudioTracks().forEach((t) => (t.enabled = micOn));
      set({ micOn });
    },

    toggleCam: () => {
      const tracks = get().localStream?.getVideoTracks() ?? [];
      if (!tracks.length) return;
      const camOn = !get().camOn;
      tracks.forEach((t) => (t.enabled = camOn));
      set({ camOn });
    },

    handleIncoming: ({ callId, conversationId, video, from }) => {
      if (get().status !== "idle") return;
      set({ status: "incoming", callId, conversationId, video, peer: from });
    },

    handleAccepted: async ({ callId }) => {
      const { localStream } = get();
      if (callId !== get().callId || !localStream) return;

      set({ status: "connecting" });
      const peer = createPeer(callId, localStream);
      try {
        await peer.setLocalDescription(await peer.createOffer());
        if (pc === peer) sendSignal(callId, { description: peer.localDescription!.toJSON() });
      } catch {
        if (pc === peer) fail("Could not start the call");
      }
    },

    handleSignal: ({ callId, data }) => {
      const peer = pc;
      if (callId !== get().callId || !peer) return;

      signalChain = signalChain.then(async () => {
        if (pc !== peer) return;
        try {
          if (data.description) {
            await peer.setRemoteDescription(data.description);
            if (data.description.type === "offer") {
              await peer.setLocalDescription(await peer.createAnswer());
              sendSignal(callId, { description: peer.localDescription!.toJSON() });
            }
          } else if (data.candidate) {
            await peer.addIceCandidate(data.candidate);
          }
        } catch {
          if (pc === peer) fail("Connection failed");
        }
      });
    },

    handleEnded: ({ callId, reason }) => {
      if (callId !== get().callId) return;
      const message =
        reason === "no-answer" && get().status === "incoming" ? "Missed call" : END_MESSAGES[reason];
      if (message) toast.info(message);
      cleanup();
    },

    handleDisconnect: () => {
      if (get().status === "idle") return;
      toast.error("Call dropped");
      cleanup();
    },
  };
});
