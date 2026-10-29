import express from "express";
import {
  createConversation,
  getConversations,
  getMessages,
  markAsSeen,
  leaveConversation,
  deleteConversation,
  updateConversationSettings,
} from "../controllers/conservationController.ts";
import { checkFriendship } from "../middlewares/friendMiddleware.ts";

const router = express.Router();

// Danh sách cuộc trò chuyện của tôi
router.get("/", getConversations);

// Lấy tin nhắn của một cuộc trò chuyện (phân trang theo cursor)
router.get("/:conversationId/messages", getMessages);

// Tạo cuộc trò chuyện direct/group (chỉ bạn bè mới được làm thành viên)
router.post("/", checkFriendship, createConversation);

// Đánh dấu cuộc trò chuyện đã xem
router.patch("/:conversationId/seen", markAsSeen);

// Rời group chat (lịch sử tới lúc rời vẫn xem được)
router.post("/:conversationId/leave", leaveConversation);

// Đổi theme chat / quick emoji dùng chung
router.patch("/:conversationId/settings", updateConversationSettings);

// Xóa group chat (chỉ người tạo)
router.delete("/:conversationId", deleteConversation);

export default router;
