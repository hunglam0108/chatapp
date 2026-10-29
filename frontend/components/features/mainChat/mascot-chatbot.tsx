'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SendIcon, XIcon } from 'lucide-react';
import { Mascot } from 'page-mascot';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSidebar } from '@/components/ui/sidebar';
import { chatbotService, type ChatbotMessage } from '@/server/chatbot';
import { themeStore } from '@/store/themeStore';
import { chatbotStore } from '@/store/chatbotStore';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'How many friends do I have?',
  'Which groups have unread messages?',
  'Who sent me friend requests?',
  'Show my account info',
];

// Đồng bộ với md:min-w-72 bên dưới và md:flex-[1_1_40rem] của khung chat trong dashboard-shell.
// Popup có shrink-[1000] nên khi thiếu chỗ nó co về tối thiểu trước, rồi khung chat co từ 640px;
// khung chat sắp nhỏ hơn MIN_CHAT_WIDTH thì popup tự đóng.
const MIN_PANEL_WIDTH = 288;
const MIN_CHAT_WIDTH = 480;

/**
 * Panel trợ lý không-modal nằm giữa sidebar và chat panel, để
 * cả hai khung chat vẫn dùng được. Chỉ đóng bằng nút X hoặc click vào
 * sidebar bên trái (trừ chính mascot, vì click mascot sẽ mở panel).
 */
export function MascotChatbot() {
  const open = chatbotStore((s) => s.open);
  const setOpen = chatbotStore((s) => s.setOpen);
  const mascotId = chatbotStore((s) => s.mascotId);
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDark = themeStore((s) => s.isDark);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const mascotRef = useRef<HTMLDivElement | null>(null);
  const { isMobile } = useSidebar();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, loading]);

  // Ưu tiên khung chat: nếu sidebar + popup + khung chat không đủ chỗ thì tự đóng popup.
  useEffect(() => {
    if (!open || isMobile) return;
    const fit = () => {
      const sidebarWidth =
        document
          .querySelector('[data-slot="sidebar-gap"]')
          ?.getBoundingClientRect().width ?? 0;
      if (sidebarWidth + MIN_PANEL_WIDTH + MIN_CHAT_WIDTH > window.innerWidth) {
        setOpen(false);
      }
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [open, isMobile, setOpen]);

  // Khi mở, mascot nhảy theo đường cong từ vị trí ở sidebar vào header.
  useEffect(() => {
    const target = mascotRef.current;
    const source = document.querySelector('[data-mascot]');
    if (!open || !target || !source) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const from = source.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    // Tính theo tâm vì mascot trong popup to hơn ở sidebar; scale từ cỡ sidebar lên cỡ thật.
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const scale = from.width / to.width;
    const animation = target.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
        {
          transform: `translate(${dx / 2}px, ${Math.min(dy, 0) / 2 - 60}px) rotate(-12deg) scale(${(scale + 1) / 2})`,
          offset: 0.45,
        },
        { transform: 'translate(0, 0) scale(1.08, 0.9)', offset: 0.85 },
        { transform: 'translate(0, 0)' },
      ],
      { duration: 600, easing: 'ease-in-out' }
    );
    return () => animation.cancel();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Element;
      if (
        target.closest('[data-slot="sidebar"]') &&
        !target.closest('[data-mascot]')
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open, setOpen]);

  const ask = async (question: string) => {
    const content = question.trim();
    if (!content || loading) return;

    const next: ChatbotMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setError(null);
    setLoading(true);
    try {
      const reply = await chatbotService.ask(next, {
        darkMode: isDark,
        mascot: mascotId,
      });
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  return (
    // Ẩn thay vì unmount để cuộc hội thoại vẫn còn sau khi đóng.
    <aside
      aria-label="Mascot assistant"
      className={cn(
        'fixed inset-0 z-50 flex-col bg-popover text-sm text-popover-foreground',
        'md:static md:inset-auto md:z-auto md:h-svh md:w-96 md:min-w-72 md:shrink-[1000] md:border-r',
        open ? 'flex' : 'hidden'
      )}
    >
      <div className="flex items-center gap-3 border-b p-4">
        {/* z-20 giữ nó trên sidebar cố định (z-10) trong lúc nhảy qua. */}
        <div ref={mascotRef} className="relative z-20 shrink-0">
          <Mascot
            directions={`/mascots/${mascotId}-directions.webp`}
            reactions={`/mascots/${mascotId}-reactions.webp`}
            size={56}
            label={`${mascotId} mascot`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-medium text-foreground">
            Mascot assistant
          </h2>
          <p className="text-sm text-muted-foreground">
            Ask about your messages, friends, account, settings or group chats.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close"
          onClick={() => setOpen(false)}
        >
          <XIcon />
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring outline-none"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm',
              m.role === 'user'
                ? 'ml-auto bg-primary text-primary-foreground'
                : 'bg-muted'
            )}
          >
            {m.content}
          </div>
        ))}

        {loading && (
          <div className="w-fit rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
            Thinking…
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something…"
          aria-label="Ask the mascot"
          maxLength={2000}
          disabled={loading}
        />
        <Button
          type="submit"
          size="icon"
          disabled={loading || !input.trim()}
          aria-label="Send"
        >
          <SendIcon />
        </Button>
      </form>
    </aside>
  );
}
