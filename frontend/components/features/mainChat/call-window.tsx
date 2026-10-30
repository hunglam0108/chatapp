"use client";

import { useEffect, useRef, useState } from "react";
import {
  MicIcon,
  MicOffIcon,
  PhoneIcon,
  PhoneOffIcon,
  VideoIcon,
  VideoOffIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { callStore } from "@/store/callStore";
import { cn } from "@/lib/utils";

function StreamVideo({
  stream,
  muted,
  className,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
}

function CallTimer({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const total = Math.max(0, Math.floor((now - since) / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return <span aria-live="off">{`${mm}:${ss}`}</span>;
}

const roundButton = "size-12 rounded-full [&_svg:not([class*='size-'])]:size-5";

/** Cửa sổ call 1-1 (voice/video): đổ chuông, đang gọi và đang nói chuyện. */
export function CallWindow() {
  const status = callStore((s) => s.status);
  const peer = callStore((s) => s.peer);
  const video = callStore((s) => s.video);
  const localStream = callStore((s) => s.localStream);
  const remoteStream = callStore((s) => s.remoteStream);
  const micOn = callStore((s) => s.micOn);
  const camOn = callStore((s) => s.camOn);
  const connectedAt = callStore((s) => s.connectedAt);

  if (status === "idle" || !peer) return null;

  const { accept, decline, hangup, toggleMic, toggleCam } = callStore.getState();
  const kind = video ? "video" : "voice";
  const showRemoteVideo = video && status === "active";
  const hasLocalVideo = !!localStream?.getVideoTracks().length;

  return (
    <div
      role="dialog"
      aria-label={`${kind} call with ${peer.displayName}`}
      className="fixed inset-0 z-100 flex flex-col items-center justify-between bg-neutral-950 p-6 text-white"
    >
      {/* Luôn render để audio của remote vẫn phát trong voice call. */}
      <StreamVideo
        stream={remoteStream}
        className={showRemoteVideo ? "absolute inset-0 size-full object-cover" : "hidden"}
      />

      <div className="relative z-10 mt-10 flex flex-col items-center gap-3 text-center">
        {showRemoteVideo ? null : (
          <Avatar className="size-24">
            {peer.avatarUrl ? <AvatarImage src={peer.avatarUrl} alt={peer.displayName} /> : null}
            <AvatarFallback className="text-2xl text-foreground">
              {peer.displayName.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        )}
        <h2 className="text-xl font-semibold drop-shadow">{peer.displayName}</h2>
        <p className="text-sm text-white/70 drop-shadow">
          {status === "incoming"
            ? `Incoming ${kind} call`
            : status === "outgoing"
              ? "Calling…"
              : status === "connecting"
                ? "Connecting…"
                : connectedAt
                  ? <CallTimer since={connectedAt} />
                  : null}
        </p>
      </div>

      {hasLocalVideo && status !== "incoming" ? (
        <StreamVideo
          stream={localStream}
          muted
          className={cn(
            "absolute top-4 right-4 z-10 aspect-3/4 w-28 rounded-lg bg-black object-cover shadow-lg sm:w-40 -scale-x-100",
            !camOn && "opacity-0"
          )}
        />
      ) : null}

      <div className="relative z-10 mb-6 flex items-center gap-4">
        {status === "incoming" ? (
          <>
            <Button
              aria-label="Decline"
              title="Decline"
              className={cn(roundButton, "bg-red-600 text-white hover:bg-red-700")}
              onClick={decline}
            >
              <PhoneOffIcon />
            </Button>
            <Button
              aria-label="Accept"
              title="Accept"
              className={cn(roundButton, "bg-green-600 text-white hover:bg-green-700")}
              onClick={() => void accept()}
            >
              {video ? <VideoIcon /> : <PhoneIcon />}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
              aria-pressed={!micOn}
              title={micOn ? "Mute" : "Unmute"}
              className={roundButton}
              onClick={toggleMic}
            >
              {micOn ? <MicIcon /> : <MicOffIcon />}
            </Button>
            {hasLocalVideo ? (
              <Button
                variant="secondary"
                aria-label={camOn ? "Turn camera off" : "Turn camera on"}
                aria-pressed={!camOn}
                title={camOn ? "Camera off" : "Camera on"}
                className={roundButton}
                onClick={toggleCam}
              >
                {camOn ? <VideoIcon /> : <VideoOffIcon />}
              </Button>
            ) : null}
            <Button
              aria-label="Hang up"
              title="Hang up"
              className={cn(roundButton, "bg-red-600 text-white hover:bg-red-700")}
              onClick={hangup}
            >
              <PhoneOffIcon />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
