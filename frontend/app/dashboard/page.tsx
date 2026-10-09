"use client";

import dynamic from "next/dynamic";
import { LoadingScreen } from "@/components/ui/loading-screen";

// The dashboard UI is driven entirely by client-only state (zustand stores +
// socket). Server-rendering it produced HTML that could never match the first
// client render, so it is loaded with ssr:false and hydrated client-side.
const DashboardShell = dynamic(
  () =>
    import("@/components/features/mainChat/dashboard-shell").then(
      (m) => m.DashboardShell
    ),
  {
    ssr: false,
    loading: () => <LoadingScreen label="Loading chats..." />,
  }
);

export default function Page() {
  return <DashboardShell />;
}