"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PaletteIcon } from "lucide-react";
import { Mascot } from "page-mascot";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { chatbotStore } from "@/store/chatbotStore";

/** Các nhân vật mascot có sprite sheet nằm trong /public/mascots. */
const MASCOTS = [
  { id: "cat", label: "Cat" },
  { id: "fox", label: "Fox" },
  { id: "bear", label: "Bear" },
  { id: "panda", label: "Panda" },
  { id: "otter", label: "Otter" },
  { id: "frog", label: "Frog" },
  { id: "penguin", label: "Penguin" },
  { id: "tiger", label: "Tiger" },
  { id: "hamster", label: "Hamster" },
  { id: "koala", label: "Koala" },
  { id: "mouse", label: "Mouse" },
  { id: "raccoon", label: "Raccoon" },
  { id: "sheep", label: "Sheep" },
  { id: "bunny", label: "Bunny" },
  { id: "deer", label: "Deer" },
  { id: "dino", label: "Dino" },
  { id: "hedgehog", label: "Hedgehog" },
  { id: "owl", label: "Owl" },
  { id: "pug", label: "Pug" },
  { id: "redpanda", label: "Red panda" },
  { id: "sloth", label: "Sloth" },
  { id: "fox-ink", label: "Fox (ink)" },
  { id: "fox-paper", label: "Fox (paper)" },
  { id: "fox-pixel", label: "Fox (pixel)" },
  { id: "fox-riso", label: "Fox (riso)" },
  { id: "fox-sketch", label: "Fox (sketch)" },
  { id: "afro", label: "Afro" },
  { id: "astronaut", label: "Astronaut" },
  { id: "bald", label: "Bald" },
  { id: "ballerina", label: "Ballerina" },
  { id: "beard", label: "Beard" },
  { id: "builder", label: "Builder" },
  { id: "cap", label: "Cap" },
  { id: "chef", label: "Chef" },
  { id: "glasses", label: "Glasses" },
  { id: "grandpa", label: "Grandpa" },
  { id: "granny", label: "Granny" },
  { id: "hijabi", label: "Hijabi" },
  { id: "kamran", label: "Kamran" },
  { id: "knight", label: "Knight" },
  { id: "nurse", label: "Nurse" },
  { id: "pirate", label: "Pirate" },
  { id: "scientist", label: "Scientist" },
  { id: "scout", label: "Scout" },
  { id: "sikh", label: "Sikh" },
  { id: "skater", label: "Skater" },
  { id: "wizard", label: "Wizard" },
  { id: "clockwork", label: "Clockwork" },
  { id: "crt", label: "CRT" },
  { id: "cube", label: "Cube" },
  { id: "drone", label: "Drone" },
  { id: "gearbot", label: "Gearbot" },
  { id: "lantern", label: "Lantern" },
  { id: "postbot", label: "Postbot" },
  { id: "radio", label: "Radio" },
  { id: "rocket", label: "Rocket" },
  { id: "toaster", label: "Toaster" },
  { id: "tv", label: "TV" },
] as const;

const STORAGE_KEY = "freebuff.mascot";

function loadMascot(): string {
  if (typeof window === "undefined") return "cat";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && MASCOTS.some((m) => m.id === saved)) return saved;
  } catch {
    // localStorage không dùng được (private mode) — dùng giá trị mặc định.
  }
  return "cat";
}

/**
 * Mascot ở sidebar (đi theo con trỏ, phản ứng khi click) kèm nút palette nhỏ
 * hiện khi hover. Click vào sẽ mở picker để user
 * đổi nhân vật; lựa chọn được lưu trong localStorage.
 */
export function MascotWidget() {
  const mascotId = chatbotStore((s) => s.mascotId);
  const setMascotId = chatbotStore((s) => s.setMascotId);
  const chatOpen = chatbotStore((s) => s.open);
  const setChatOpen = chatbotStore((s) => s.setOpen);
  const { isMobile, setOpenMobile } = useSidebar();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ top: 60, left: 16 });

  // Lấy lựa chọn đã lưu sau khi mount (localStorage không có khi SSR).
  useEffect(() => {
    setMascotId(loadMascot());
  }, [setMascotId]);

  const openChatbot = () => {
    setChatOpen(true);
    // Trên mobile sidebar là sheet sẽ che mất chatbot.
    if (isMobile) setOpenMobile(false);
  };

  const togglePicker = () => {
    if (!open) {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) {
        setPosition({
          top: Math.min(rect.bottom + 6, window.innerHeight - 310),
          left: Math.min(Math.max(rect.left - 80, 8), window.innerWidth - 240),
        });
      }
    }
    setOpen((v) => !v);
  };

  const choose = (id: string) => {
    setMascotId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Best effort — lựa chọn vẫn áp dụng cho phiên hiện tại.
    }
    setOpen(false);
  };

  return (
    <div
      ref={anchorRef}
      data-mascot
      className="relative shrink-0 group/mascot group-data-[collapsible=icon]:mx-auto"
    >
      {/* Mascot tự render <button>; sự kiện click nổi bọt lên đây để mở chatbot.
          Khi chatbot đang mở, mascot nằm trong header của nó nên ở đây chỉ giữ chỗ. */}
      <div onClick={openChatbot} className={cn(chatOpen && "invisible")}>
        <Mascot
          directions={`/mascots/${mascotId}-directions.webp`}
          reactions={`/mascots/${mascotId}-reactions.webp`}
          size={40}
          label={`${mascotId} mascot`}
        />
      </div>
      <button
        type="button"
        aria-label="Choose mascot"
        title="Choose mascot"
        onClick={togglePicker}
        className={cn(
          "absolute z-10 flex items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-opacity",
          "hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          // Khi mascot đã nhảy vào popup: nút nằm giữa chỗ trống và luôn hiện.
          chatOpen
            ? "top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2"
            : "-right-1.5 -bottom-1 size-4 opacity-0 group-hover/mascot:opacity-100"
        )}
      >
        <PaletteIcon className={chatOpen ? "size-3.5" : "size-2.5"} />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setOpen(false)}
              />
              <div
                className="fixed z-50 w-56 rounded-xl border bg-popover p-1.5 shadow-lg"
                style={{ top: position.top, left: position.left }}
                role="dialog"
                aria-label="Choose mascot"
              >
                <p className="px-1.5 pb-1 text-xs font-medium text-muted-foreground">
                  Mascot
                </p>
                <div className="grid max-h-72 grid-cols-4 gap-1 overflow-y-auto">
                  {MASCOTS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-label={m.label}
                      title={m.label}
                      aria-pressed={m.id === mascotId}
                      onClick={() => choose(m.id)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-md p-1.5 transition-colors",
                        "hover:bg-muted focus-visible:ring-2 focus-visible:ring-sidebar-ring outline-none",
                        m.id === mascotId && "bg-primary/10 ring-1 ring-primary"
                      )}
                    >
                      {/* Sheet là lưới 3x3 — hiển thị frame đầu tiên. Dùng <img loading="lazy">
                          để chỉ tải ảnh của những ô đang hiện trong vùng cuộn. */}
                      <span className="relative size-8 overflow-hidden rounded bg-muted">
                        <img
                          src={`/mascots/${m.id}-directions.webp`}
                          alt=""
                          loading="lazy"
                          className="absolute top-0 left-0 h-[300%] w-[300%] max-w-none"
                        />
                      </span>
                      <span className="w-full truncate text-center text-[9px] leading-none text-muted-foreground">
                        {m.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  );
}
