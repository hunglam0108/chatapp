"use client";

import { AppSidebar } from "@/components/features/mainChat/app-sidebar";
import { ChatPanel } from "@/components/features/mainChat/chat-panel";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { useSocket } from "@/hooks/use-socket";

/**
 * Client shell for the chat dashboard. Owns the socket lifecycle (connection,
 * real-time sync, presence) via useSocket and lays out sidebar + chat panel.
 */
export function DashboardShell() {
  useSocket();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden">
        <ChatPanel />
      </SidebarInset>
    </SidebarProvider>
  );
}
