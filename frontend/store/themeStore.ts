import { create } from "zustand";
import type { ThemeState } from "@/types/SocketType";

export const THEME_STORAGE_KEY = "theme";

// Chạy inline trong <head> trước lần paint đầu tiên để tránh nháy theme.
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export const themeStore = create<ThemeState>((set, get) => ({
  // Inline script đã gắn class "dark" lên <html> nên lấy luôn làm giá trị ban đầu.
  isDark:
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark"),
  setTheme: (dark) => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
    } catch {
      // localStorage có thể bị chặn (private mode); theme vẫn áp dụng cho phiên hiện tại.
    }
    set({ isDark: dark });
  },
  toggleTheme: () => get().setTheme(!get().isDark),
}));
