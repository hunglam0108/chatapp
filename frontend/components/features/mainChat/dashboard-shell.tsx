"use client";

import { AppSidebar } from "@/components/features/mainChat/app-sidebar";
import { CallWindow } from "@/components/features/mainChat/call-window";
import { ChatPanel } from "@/components/features/mainChat/chat-panel";
import { MascotChatbot } from "@/components/features/mainChat/mascot-chatbot";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { useSocket } from "@/hooks/use-socket";

/**
 * Client shell cho dashboard chat. Quản lý vòng đời socket (kết nối,
 * đồng bộ real-time, presence) qua useSocket và bố trí sidebar + chat panel.
 */
export function DashboardShell() {
  useSocket();

  return (
    <SidebarProvider>
      <AppSidebar />
      <MascotChatbot />
      <SidebarInset className="h-svh min-w-0 overflow-hidden md:min-w-80 md:flex-[1_1_40rem]">
        <ChatPanel />
      </SidebarInset>
      <CallWindow />
    </SidebarProvider>
  );
}
