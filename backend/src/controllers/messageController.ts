import Conversation from "../models/Conversation.ts";
import Message from "../models/Message.ts";
import {
  emitNewMessage,
  updateConversationAfterCreateMessage,
} from "../utils/messageHelper.ts";
import { getIo } from "../socket/index.ts";
import { isValidEmoji } from "../utils/emojiHelper.ts";
import { deleteCloudinaryFiles, isUploadedAttachmentUrl } from "../utils/cloudinary.ts";

export const sendDirectMessage = async (req, res) => {
  try {
    const { recipientId, content, conversationId } = req.body;
    const senderId = req.user._id;

    let conversation;

    const { imgUrl, audioUrl, fileUrl, fileMeta, stickerUrl } = req.body;

    // Text, ảnh, voice/audio và file đính kèm đều là payload hợp lệ —
    // chỉ tin nhắn hoàn toàn rỗng mới bị từ chối.
    if (!content && !imgUrl && !audioUrl && !fileUrl && !stickerUrl) {
      return res.status(400).json({ message: "Content is required" });
    }

    if ([imgUrl, audioUrl, fileUrl, stickerUrl].some((url) => url && !isUploadedAttachmentUrl(url))) {
      return res.status(400).json({ message: "Invalid attachment" });
    }

    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
    }

    if (!conversation) {
      conversation = await Conversation.create({
        type: "direct",
        participants: [
          { userId: senderId, joinedAt: new Date() },
          { userId: recipientId, joinedAt: new Date() },
        ],
        lastMessageAt: new Date(),
        unreadCounts: new Map(),
      });
    }

    const message = await Message.create({
      conversationId: conversation._id,
      senderId,
      content: content || undefined,
      ...(imgUrl ? { imgUrl } : {}),
      ...(audioUrl ? { audioUrl } : {}),
      ...(fileUrl ? { fileUrl, fileMeta } : {}),
      ...(stickerUrl ? { stickerUrl } : {}),
    });

    updateConversationAfterCreateMessage(conversation, message, senderId);

    await conversation.save();

    emitNewMessage(getIo(), conversation, message);

    return res.status(201).json({ message });
  } catch (error) {
    console.error("Error sending direct message", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    const senderId = req.user._id;
    const conversation = req.conversation;

    const { imgUrl, audioUrl, fileUrl, fileMeta, stickerUrl } = req.body;

    if (!content && !imgUrl && !audioUrl && !fileUrl && !stickerUrl) {
      return res.status(400).json({ message: "Content is required" });
    }

    if ([imgUrl, audioUrl, fileUrl, stickerUrl].some((url) => url && !isUploadedAttachmentUrl(url))) {
      return res.status(400).json({ message: "Invalid attachment" });
    }

    const message = await Message.create({
      conversationId,
      senderId,
      content: content || undefined,
      ...(imgUrl ? { imgUrl } : {}),
      ...(audioUrl ? { audioUrl } : {}),
      ...(fileUrl ? { fileUrl, fileMeta } : {}),
      ...(stickerUrl ? { stickerUrl } : {}),
    });

    updateConversationAfterCreateMessage(conversation, message, senderId);

    await conversation.save();
    emitNewMessage(getIo(), conversation, message);

    return res.status(201).json({ message });
  } catch (error) {
    console.error("Error sending group message", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * PUT /api/messages/:messageId/reaction { emoji }
 * Gửi lại cùng emoji sẽ bỏ reaction của mình, emoji khác sẽ thay thế.
 */
export const toggleReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id.toString();

    // Reaction bằng custom emoji được lưu dưới dạng URL ảnh đã upload.
    if (!isValidEmoji(emoji) && !isUploadedAttachmentUrl(emoji)) {
      return res.status(400).json({ message: "Invalid emoji" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const conversation = await Conversation.findById(message.conversationId, {
      participants: 1,
    }).lean();
    const isMember = (conversation?.participants || []).some(
      (p) => p.userId.toString() === userId
    );
    if (!isMember) {
      return res.status(403).json({ message: "You are not in this conversation" });
    }

    const mine = message.reactions.find((r) => r.userId.toString() === userId);
    const others = message.reactions.filter((r) => r.userId.toString() !== userId);
    message.set(
      "reactions",
      mine?.emoji === emoji ? others : [...others, { userId, emoji }]
    );
    await message.save();

    const payload = {
      conversationId: message.conversationId.toString(),
      messageId: message._id.toString(),
      reactions: message.reactions,
    };
    getIo().to(payload.conversationId).emit("message-reaction", payload);

    return res.status(200).json(payload);
  } catch (error) {
    console.error("Error reacting to message", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const EDIT_WINDOW_MS = 15 * 60 * 1000;

/** Lấy tin nhắn do user hiện tại gửi, hoặc trả 404/403 và return null. */
const findOwnMessage = async (req, res) => {
  const message = await Message.findById(req.params.messageId);
  if (!message) {
    res.status(404).json({ message: "Message not found" });
    return null;
  }
  if (message.senderId.toString() !== req.user._id.toString()) {
    res.status(403).json({ message: "Only the sender can modify this message" });
    return null;
  }
  return message;
};

/** Đồng bộ preview ở sidebar nếu đây là tin nhắn cuối, rồi thông báo cho room. */
const emitMessageUpdated = async (message) => {
  const conversationId = message.conversationId.toString();
  const conversation = await Conversation.findById(conversationId);
  let lastMessage;
  if (conversation?.lastMessage?._id === message._id.toString()) {
    conversation.set("lastMessage.content", message.content ?? null);
    conversation.set("lastMessage.recalled", !!message.recalledAt);
    await conversation.save();
    lastMessage = conversation.lastMessage;
  }
  getIo().to(conversationId).emit("message-updated", { message, lastMessage });
};

/** PATCH /api/messages/:messageId { content } — sửa text của mình trong vòng 15 phút. */
export const editMessage = async (req, res) => {
  try {
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (!content) {
      return res.status(400).json({ message: "Content is required" });
    }

    const message = await findOwnMessage(req, res);
    if (!message) return;

    if (message.recalledAt || !message.content) {
      return res.status(400).json({ message: "This message cannot be edited" });
    }
    if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
      return res.status(400).json({ message: "Messages can only be edited within 15 minutes" });
    }

    message.set({ content, editedAt: new Date() });
    await message.save();
    await emitMessageUpdated(message);

    return res.status(200).json({ message });
  } catch (error) {
    console.error("Error editing message", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * DELETE /api/messages/:messageId — thu hồi tin nhắn của mình với mọi người, bất cứ lúc nào.
 * File đã upload bị xóa khỏi Cloudinary; sticker được giữ nguyên
 * vì chúng thuộc bộ custom emoji của người gửi.
 */
export const recallMessage = async (req, res) => {
  try {
    const message = await findOwnMessage(req, res);
    if (!message) return;

    if (message.recalledAt) {
      return res.status(200).json({ message });
    }

    const files = [message.imgUrl, message.audioUrl, message.fileUrl];
    message.set({
      content: undefined,
      imgUrl: undefined,
      audioUrl: undefined,
      fileUrl: undefined,
      fileMeta: undefined,
      stickerUrl: undefined,
      editedAt: undefined,
      reactions: [],
      recalledAt: new Date(),
    });
    await message.save();
    await deleteCloudinaryFiles(files);
    await emitMessageUpdated(message);

    return res.status(200).json({ message });
  } catch (error) {
    console.error("Error unsending message", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
