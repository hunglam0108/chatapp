import express from "express";
import {
  sendDirectMessage,
  sendGroupMessage,
} from "../controllers/messageController.ts";
import { checkGroupMembership } from "../middlewares/friendMiddleware.ts";

const router = express.Router();

// POST /api/messages/direct { recipientId, content, conversationId? }
router.post("/direct", sendDirectMessage);

// POST /api/messages/group { conversationId, content }
router.post("/group", checkGroupMembership, sendGroupMessage);

export default router;
