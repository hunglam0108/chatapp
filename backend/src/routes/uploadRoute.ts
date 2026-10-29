import express from "express";
import {
  uploadMiddleware,
  uploadFile,
  MAX_UPLOAD_BYTES,
} from "../controllers/uploadController.ts";
import { protectedRoute } from "../middlewares/authMiddleware.ts";

const router = express.Router();

// POST /api/upload/file (multipart/form-data, field "file") — tối đa 10MB.
// Được mount tại /api/upload, nên endpoint là /api/upload/file.
router.post(
  "/file",
  protectedRoute,
  uploadMiddleware.single("file"),
  (err: any, _req: any, res: any, next: any) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(413)
          .json({ message: `File too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB)` });
      }
      return res.status(400).json({ message: err.message || "Upload failed" });
    }
    next();
  },
  uploadFile
);

export default router;
