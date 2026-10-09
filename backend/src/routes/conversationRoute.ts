import express from "express";
import {
  createConversation,
  getConversations,
  getMessages,
  markAsSeen,
  leaveConversation,
  deleteConversation,
} from "../controllers/conservationController.ts";
import { checkFriendship } from "../middlewares/friendMiddleware.ts";

const router = express.Router();

// List my conversations
router.get("/", getConversations);

// Fetch messages of one conversation (cursor pagination)
router.get("/:conversationId/messages", getMessages);

// Create direct/group conversation (only friends can be members)
router.post("/", checkFriendship, createConversation);

// Mark conversation as seen
router.patch("/:conversationId/seen", markAsSeen);

// Leave a group chat (history up to leaving stays visible)
router.post("/:conversationId/leave", leaveConversation);

// Delete a group chat (creator only)
router.delete("/:conversationId", deleteConversation);

export default router;
