"use client";

import dynamic from "next/dynamic";
import { LoadingScreen } from "@/components/ui/loading-screen";

// UI dashboard hoàn toàn dựa vào state chỉ có ở client (zustand store +
// socket). Render phía server tạo ra HTML không bao giờ khớp với lần render
// đầu ở client, nên được load với ssr:false và hydrate phía client.
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