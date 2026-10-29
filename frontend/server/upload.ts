import { api } from "./api";
import type { FileMeta } from "@/types/ConversationType";

export interface UploadResult {
  url: string;
  filename: string;
  originalname: string;
  size: number;
  mimetype: string;
  kind: "image" | "audio" | "file";
}

/** Giới hạn upload 10 MB, khớp với giới hạn multer ở backend. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * Upload một file (ảnh / voice note / mọi loại được phép) qua multipart
 * form-data. Kiểm tra giới hạn 10 MB ở client trước khi gọi API.
 */
export async function uploadFile(file: File): Promise<UploadResult> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`File is too large (max ${formatBytes(MAX_FILE_BYTES)})`);
  }

  const form = new FormData();
  form.append("file", file, file.name || "attachment");

  // Để axios tự đặt Content-Type multipart kèm boundary.
  const res = await api.post<UploadResult, FormData>("/upload/file", form, {
    headers: { "Content-Type": undefined },
  });
  return res;
}

/** Tạo payload FileMeta cho tin nhắn file thông thường. */
export function buildFileMeta(result: UploadResult): FileMeta {
  return {
    name: result.originalname || result.filename,
    size: result.size,
    mimetype: result.mimetype,
  };
}
