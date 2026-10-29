import express from "express";
import {
  createEmoji,
  deleteEmoji,
  getMyEmojis,
} from "../controllers/emojiController.ts";

const router = express.Router();

// Custom emoji của tôi (ảnh phải upload qua /api/upload/file trước)
router.get("/", getMyEmojis);
router.post("/", createEmoji);
router.delete("/:emojiId", deleteEmoji);

export default router;
