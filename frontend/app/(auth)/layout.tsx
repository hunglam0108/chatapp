import { MessageCircleIcon } from "lucide-react";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative isolate flex min-h-svh flex-col overflow-hidden bg-linear-to-br from-primary/60 via-primary/85 to-secondary-foreground text-foreground dark:from-primary dark:via-primary/60 dark:to-background">
      <ChatBubblePattern />

      <div className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 items-center md:grid-cols-2">
        <section className="flex flex-col items-center gap-3 px-6 pt-10 text-center text-white md:order-2 md:pt-0">
          <span className="relative flex size-14 items-center justify-center rounded-full bg-card text-primary shadow-lg md:size-16 dark:text-primary-foreground">
            <MessageCircleIcon className="size-7 md:size-8" strokeWidth={2.2} />
          </span>
          <h1 className="text-2xl font-bold tracking-wide drop-shadow-sm md:text-3xl">
            Kuro Chat
          </h1>
          <p className="max-w-sm text-sm text-balance text-white/85 md:text-base">
            Message, call your groups and share moments with friends — fast, simple,
            realtime.
          </p>
        </section>

        <div className="flex md:order-1">{children}</div>
      </div>
    </div>
  );
}

/** Các bong bóng chat viền mờ với dấu chấm "typing" lát nền phía sau các trang auth. */
function ChatBubblePattern() {
  return (
    <svg className="absolute inset-0 -z-10 size-full text-white/15 dark:text-white/[0.06]" aria-hidden>
      <defs>
        <pattern
          id="auth-chat-bubbles"
          width="260"
          height="240"
          patternUnits="userSpaceOnUse"
        >
          <g fill="none" stroke="currentColor" strokeWidth="4">
            <path d="M70 20a55 55 0 1 1-30 101l-28 9 10-26A55 55 0 0 1 70 20Z" />
            <path d="M200 140a42 42 0 1 0 23 77l22 7-8-20a42 42 0 0 0-37-64Z" />
          </g>
          <g fill="currentColor">
            <circle cx="48" cy="75" r="7" />
            <circle cx="70" cy="75" r="7" />
            <circle cx="92" cy="75" r="7" />
            <circle cx="184" cy="182" r="5.5" />
            <circle cx="200" cy="182" r="5.5" />
            <circle cx="216" cy="182" r="5.5" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#auth-chat-bubbles)" />
    </svg>
  );
}
