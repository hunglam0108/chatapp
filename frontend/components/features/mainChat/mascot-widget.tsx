"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PaletteIcon } from "lucide-react";
import { Mascot } from "page-mascot";
import { cn } from "@/lib/utils";

/** Mascot characters whose sprite sheets live in /public/mascots. */
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
] as const;

const STORAGE_KEY = "freebuff.mascot";

function loadMascot(): string {
  if (typeof window === "undefined") return "cat";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && MASCOTS.some((m) => m.id === saved)) return saved;
  } catch {
    // localStorage unavailable (private mode) — fall back to the default.
  }
  return "cat";
}

/**
 * Sidebar mascot (follows the cursor, reacts to clicks) with a small palette
 * button that appears on hover. Clicking it opens a picker so the user can
 * swap characters; the choice is persisted in localStorage.
 */
export function MascotWidget() {
  const [mascotId, setMascotId] = useState<string>("cat");
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ top: 60, left: 16 });

  // Hydrate the saved choice after mount (localStorage isn't available during SSR).
  useEffect(() => {
    setMascotId(loadMascot());
  }, []);

  const togglePicker = () => {
    if (!open) {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) {
        setPosition({
          top: Math.min(rect.bottom + 6, window.innerHeight - 260),
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
      // Best effort — the picker still applies for this session.
    }
    setOpen(false);
  };

  return (
    <div
      ref={anchorRef}
      className="relative shrink-0 group/mascot group-data-[collapsible=icon]:mx-auto"
    >
      <Mascot
        directions={`/mascots/${mascotId}-directions.webp`}
        reactions={`/mascots/${mascotId}-reactions.webp`}
        size={40}
        label={`${mascotId} mascot`}
      />
      <button
        type="button"
        aria-label="Choose mascot"
        title="Choose mascot"
        onClick={togglePicker}
        className={cn(
          "absolute -right-1.5 -bottom-1 z-10 flex size-4 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-opacity",
          "hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          "opacity-0 group-hover/mascot:opacity-100"
        )}
      >
        <PaletteIcon className="size-2.5" />
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
                <div className="grid grid-cols-4 gap-1">
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
                      <span
                        className="size-8 rounded bg-muted bg-no-repeat"
                        style={{
                          backgroundImage: `url(/mascots/${m.id}-directions.webp)`,
                          // The sheet is a 3x3 grid — show its first frame.
                          backgroundSize: "300% 300%",
                          backgroundPosition: "0 0",
                        }}
                      />
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
