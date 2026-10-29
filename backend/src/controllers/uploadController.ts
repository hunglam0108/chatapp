import multer from "multer";
import type { Request } from "express";
import { uploadToCloudinary } from "../utils/cloudinary.ts";

// Giới hạn upload 10 MB, áp dụng bởi multer (payload) VÀ các bước validate.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/heic": "heic",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/zip": "zip",
};

// Chỉ cho phép ảnh, audio và các loại file nhị phân thông dụng.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ALLOWED_PREFIXES = ["image/", "audio/", "text/", "video/"];
const allowlistedMimes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
]);

const filterFile = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const mime = file.mimetype || "application/octet-stream";
  if (allowlistedMimes.has(mime) || ALLOWED_PREFIXES.some((p) => mime.startsWith(p))) {
    return cb(null, true);
  }
  cb(new Error("Unsupported file type"));
};

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: filterFile,
});

/**
 * POST /api/upload/file (multipart/form-data, field name: "file")
 * Trả về { url, size, mimetype, originalname } — URL sau đó được caller gắn vào
 * tin nhắn (sendDirectMessage / sendGroupMessage).
 */
export const uploadFile = async (req: any, res: any) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const ext = MIME_EXT[file.mimetype] ?? "";
    const { url, publicId } = await uploadToCloudinary(file, ext);

    return res.status(201).json({
      url,
      filename: publicId,
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      kind: file.mimetype?.startsWith("image/") ? "image" : file.mimetype?.startsWith("audio/") ? "audio" : "file",
      ext,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/** POST /api/upload/image — cùng handler nhưng chỉ cho phép ảnh. */
export const imageFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype?.startsWith("image/")) {
    return cb(null, true);
  }
  cb(new Error("Only image files are allowed"));
};
