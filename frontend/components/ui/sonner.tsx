"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import { themeStore } from "@/store/themeStore";

export function Toaster(props: ToasterProps) {
  const isDark = themeStore((s) => s.isDark);

  return <Sonner theme={isDark ? "dark" : "light"} {...props} />;
}
