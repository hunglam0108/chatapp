import express from "express";
import {
  sendDirectMessage,
  sendGroupMessage,
  toggleReaction,
  editMessage,
  recallMessage,
} from "../controllers/messageController.ts";
import { checkGroupMembership } from "../middlewares/friendMiddleware.ts";

const router = express.Router();

// POST /api/messages/direct { recipientId, content, conversationId? }
router.post("/direct", sendDirectMessage);

// POST /api/messages/group { conversationId, content }
router.post("/group", checkGroupMembership, sendGroupMessage);

// PUT /api/messages/:messageId/reaction { emoji } — bật/tắt reaction của mình
router.put("/:messageId/reaction", toggleReaction);

// PATCH /api/messages/:messageId { content } — sửa text của mình (trong vòng 15 phút)
router.patch("/:messageId", editMessage);

// DELETE /api/messages/:messageId — thu hồi tin nhắn của mình với mọi người
router.delete("/:messageId", recallMessage);

export default router;
