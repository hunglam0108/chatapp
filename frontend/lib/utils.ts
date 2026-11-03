import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Message lỗi để hiện cho user — ApiError đã mang message từ backend. */
export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
