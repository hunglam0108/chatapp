import Conversation, { CHAT_THEME_IDS } from "../models/Conversation.ts";
import Message from "../models/Message.ts";
import { getIo } from "../socket/index.ts";
import { isValidEmoji } from "../utils/emojiHelper.ts";
import { deleteCloudinaryFiles } from "../utils/cloudinary.ts";

/**
 * Định dạng conversation doc cho client: participants đang hoạt động đã populate,
 * formerMembers (những người đã rời) và unreadCounts dạng plain object.
 *
 * Khi có `viewerId` và người xem đó đã rời nhóm, kết quả bị
 * đóng băng tại thời điểm họ rời: tin nhắn gửi sau đó (lastMessage) bị
 * ẩn để người rời vẫn giữ lịch sử cũ mà không xem được tin nhắn mới.
 */
const serializeConversation = (convo: any, viewerId?: string) => {
  const participants = (convo.participants || []).map((p: any) => ({
    _id: p.userId?._id,
    displayName: p.userId?.displayName,
    avatarUrl: p.userId?.avatarUrl ?? null,
    joinedAt: p.joinAt ?? p.joinedAt,
  }));

  const formerMembers = (convo.formerMembers || []).map((fm: any) => ({
    _id: fm.userId?._id,
    displayName: fm.userId?.displayName,
    avatarUrl: fm.userId?.avatarUrl ?? null,
    leftAt: fm.leftAt,
  }));

  const formatted = {
    ...convo.toObject(),
    participants,
    formerMembers,
    unreadCounts:
      convo.unreadCounts instanceof Map
        ? Object.fromEntries(convo.unreadCounts)
        : (convo.unreadCounts ?? {}),
  };

  if (viewerId) {
    const viewerIdStr = viewerId.toString();
    const stillMember = (convo.participants || []).some(
      (p: any) => p.userId?._id?.toString() === viewerIdStr
    );
    const myLeave = (convo.formerMembers || []).find(
      (fm: any) => fm.userId?._id?.toString() === viewerIdStr
    );

    if (myLeave && !stillMember) {
      const leftAt = new Date(myLeave.leftAt);
      const last = convo.lastMessage;

      if (!last || new Date(last.createdAt) > leftAt) {
        formatted.lastMessage = null;
        formatted.lastMessageAt = myLeave.leftAt;
      }
      formatted.unreadCounts = { ...formatted.unreadCounts, [viewerIdStr]: 0 };
    }
  }

  return formatted;
};

export const createConversation = async (req: any, res: any) => {
  try {
    const { type, name, memberIds } = req.body;
    const userId = req.user._id;

    if (
      !type ||
      !memberIds ||
      !Array.isArray(memberIds) ||
      memberIds.length === 0
    ) {
      return res
        .status(400)
        .json({ message: "Conversation type and member list are required" });
    }

    let conversation;

    if (type === "direct") {
      const participantId = memberIds[0];

      conversation = await Conversation.findOne({
        type: "direct",
        "participants.userId": { $all: [userId, participantId] },
      });

      if (!conversation) {
        conversation = new Conversation({
          type: "direct",
          participants: [{ userId }, { userId: participantId }],
          lastMessageAt: new Date(),
        });

        await conversation.save();
      }
    }

    if (type === "group") {
      const creatorParticipant = { userId };
      const otherMembers = memberIds.map((id) => ({ userId: id }));

      let groupPayload: { name: string; createdBy: typeof userId };

      if (name && name.trim()) {
        // Có tên tùy chỉnh — dùng trực tiếp.
        groupPayload = { name: name.trim(), createdBy: userId };
      } else {
        // Không có tên. Tạo doc chưa có group.name; sau khi save sẽ
        // lấy displayName của người tạo từ mảng participants và đặt
        // tên mặc định "Group chat of {creator} #{shortId}".
        groupPayload = { name: "", createdBy: userId };
      }

      conversation = new Conversation({
        type: "group",
        participants: [creatorParticipant, ...otherMembers],
        group: groupPayload,
        lastMessageAt: new Date(),
      });

      await conversation.save();
    }

    if (!conversation) {
      return res.status(400).json({ message: "Invalid conversation type" });
    }

    // Populate conversation để response có displayName/avatarUrl cho
    // participants, formerMembers và người gửi tin nhắn cuối.
    await conversation.populate([
      { path: "participants.userId", select: "displayName avatarUrl" },
      {
        path: "seenBy",
        select: "displayName avatarUrl",
      },
      { path: "lastMessage.senderId", select: "displayName avatarUrl" },
    ]);

    const participants = (conversation.participants || []).map((p: any) => ({
      _id: p.userId?._id,
      displayName: p.userId?.displayName,
      avatarUrl: p.userId?.avatarUrl ?? null,
      joinedAt: p.joinAt ?? p.joinedAt,
    }));

    const formerMembers = (conversation.formerMembers || []).map((fm: any) => ({
      _id: fm.userId?._id,
      displayName: fm.userId?.displayName,
      avatarUrl: fm.userId?.avatarUrl ?? null,
      leftAt: fm.leftAt,
    }));

    const formatted = {
      ...conversation.toObject(),
      participants,
      formerMembers,
    };

    if (type === "group") {
      const recipientSet = new Set<string>([userId, ...memberIds]);
      recipientSet.forEach((id) => {
        getIo().to(id).emit("new-group", formatted);
      });
    }

    if (type === "direct") {
      const [recipientId] = memberIds;
      if (recipientId) {
        getIo().to(userId).emit("new-group", formatted);
        if (recipientId !== userId) {
          getIo().to(recipientId).emit("new-group", formatted);
        }
      }
    }

    return res.status(201).json({ conversation: formatted });
  } catch (error) {
    console.error("Error creating conversation", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getConversations = async (req: any, res: any) => {
  try {
    const userId = req.user._id;
    // Thành viên đang hoạt động thấy chat trực tiếp; thành viên đã rời vẫn giữ conversation
    // trong danh sách để còn mở được lịch sử cũ.
    const conversations = await Conversation.find({
      $or: [{ "participants.userId": userId }, { "formerMembers.userId": userId }],
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate({
        path: "participants.userId",
        select: "displayName avatarUrl",
      })
      .populate({
        path: "formerMembers.userId",
        select: "displayName avatarUrl",
      })
      .populate({
        path: "lastMessage.senderId",
        select: "displayName avatarUrl",
      })
      .populate({
        path: "seenBy",
        select: "displayName avatarUrl",
      });

    const formatted = conversations.map((convo) =>
      serializeConversation(convo, userId)
    );

    return res.status(200).json({ conversations: formatted });
  } catch (error) {
    console.error("Error fetching conversations", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getMessages = async (req:any, res:any) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, cursor } = req.query;
    const userId = req.user._id.toString();

    const conversation = await Conversation.findById(conversationId).lean();

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const isMember = (conversation.participants || []).some(
      (p: any) => p.userId.toString() === userId
    );
    const myLeave = (conversation.formerMembers || []).find(
      (fm: any) => fm.userId.toString() === userId
    );

    if (!isMember && !myLeave) {
      return res.status(403).json({
        message: "You do not have permission to view this conversation",
      });
    }

    const query: any = { conversationId };

    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }

    // Thành viên đã rời chỉ thấy lịch sử tới thời điểm rời —
    // tin nhắn gửi sau đó bị ẩn với họ.
    if (!isMember && myLeave) {
      query.createdAt = { ...(query.createdAt ?? {}), $lte: myLeave.leftAt };
    }

    let messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit) + 1);

    let nextCursor = null;

    if (messages.length > Number(limit)) {
      const nextMessage = messages[messages.length - 1];
      nextCursor = nextMessage.createdAt.toISOString();
      messages.pop();
    }

    messages = messages.reverse();

    return res.status(200).json({
      messages,
      nextCursor,
    });
  } catch (error) {
    console.error("Error fetching messages", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getUserConversationsForSocketIO = async (userId:string) => {
  try {
    const conversations = await Conversation.find(
      { "participants.userId": userId },
      { _id: 1 },
    );

    return conversations.map((c) => c._id.toString());
  } catch (error) {
    console.error("Error fetching conversations: ", error);
    return [];
  }
};

export const markAsSeen = async (req:any, res:any) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id.toString();

    const conversation = await Conversation.findById(conversationId).lean();

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const last = conversation.lastMessage;

    if (!last) {
      return res.status(200).json({ message: "No messages to mark as seen" });
    }

    if (last.senderId?.toString() === userId) {
      return res.status(200).json({ message: "Sender does not need to mark as seen" });
    }

    const updated = await Conversation.findByIdAndUpdate(
      conversationId,
      {
        $addToSet: { seenBy: userId },
        $set: { [`unreadCounts.${userId}`]: 0 },
      },
      {
        new: true,
      },
    );

    getIo().to(conversationId).emit("read-message", {
      conversation: updated,
      lastMessage: {
        _id: updated?.lastMessage?._id,
        content: updated?.lastMessage?.content,
        createdAt: updated?.lastMessage?.createdAt,
        recalled: updated?.lastMessage?.recalled,
        sender: {
          _id: updated?.lastMessage?.senderId,
        },
      },
    });

    return res.status(200).json({
      message: "Marked as seen",
      seenBy: updated?.seenBy || [],
      myUnreadCount: updated?.unreadCounts.get(userId) || 0,
    });
  } catch (error) {
    console.error("Error marking as seen", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Rời group chat. Người rời được chuyển từ `participants` sang
 * `formerMembers` (kèm leftAt) để vẫn đọc được lịch sử tới thời điểm đó,
 * nhưng không còn nhận tin nhắn mới từ nhóm.
 */
export const leaveConversation = async (req: any, res: any) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (conversation.type !== "group") {
      return res.status(400).json({ message: "Only group chats can be left" });
    }

    const isMember = (conversation.participants || []).some(
      (p: any) => p.userId.toString() === userId.toString()
    );

    if (!isMember) {
      return res.status(400).json({ message: "You are not a member of this group." });
    }

    const wasCreator =
      conversation.group?.createdBy?.toString() === userId.toString();

    conversation.set(
      "participants",
      conversation.participants.filter(
        (p: any) => p.userId.toString() !== userId.toString()
      )
    );
    conversation.formerMembers = conversation.formerMembers || [];
    conversation.formerMembers.push({ userId, leftAt: new Date() });

    // Nếu người tạo rời nhóm, thành viên còn lại tham gia sớm nhất sẽ
    // làm owner (có quyền xóa nhóm). Nếu không còn ai,
    // người tạo giữ quyền owner để vẫn xóa được nhóm bị bỏ trống.
    if (wasCreator && conversation.participants.length > 0) {
      const [nextOwner] = [...conversation.participants].sort(
        (a: any, b: any) =>
          new Date(a.joinAt ?? 0).getTime() - new Date(b.joinAt ?? 0).getTime()
      );

      if (nextOwner && conversation.group) {
        conversation.group.createdBy = nextOwner.userId;
      }
    }

    if (!conversation.unreadCounts) {
      conversation.unreadCounts = new Map();
    }
    conversation.unreadCounts.set(userId.toString(), 0);
    await conversation.save();

    await conversation.populate([
      { path: "participants.userId", select: "displayName avatarUrl" },
      { path: "formerMembers.userId", select: "displayName avatarUrl" },
      { path: "lastMessage.senderId", select: "displayName avatarUrl" },
    ]);

    // Thành viên giữ view trực tiếp; view của người rời bị đóng băng tại leftAt.
    const memberView = serializeConversation(conversation);
    const leaverView = serializeConversation(conversation, userId);

    // Mọi người còn trong room (kể cả các socket đang mở của người rời).
    getIo().to(conversationId).emit("group-member-left", {
      conversationId,
      userId,
      conversation: memberView,
    });
    // Các thiết bị khác của người rời lắng nghe trên room cá nhân.
    getIo().to(userId.toString()).emit("group-left", {
      conversationId,
      conversation: leaverView,
    });

    return res.status(200).json({
      message: "You left the group",
      conversation: leaverView,
    });
  } catch (error) {
    console.error("Error leaving group", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Xóa group chat. Chỉ người tạo nhóm mới được xóa.
 * Xóa conversation và toàn bộ tin nhắn, rồi thông báo cho mọi thành viên
 * (và thành viên cũ) để client của họ bỏ conversation.
 */
export const deleteConversation = async (req: any, res: any) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (conversation.type !== "group") {
      return res.status(400).json({ message: "Only group chats can be deleted" });
    }

    if (conversation.group?.createdBy?.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Only the group creator can delete the group" });
    }

    const files = await Message.find(
      { conversationId: conversation._id },
      { imgUrl: 1, audioUrl: 1, fileUrl: 1 }
    ).lean();
    await deleteCloudinaryFiles(files.flatMap((m) => [m.imgUrl, m.audioUrl, m.fileUrl]));
    await Message.deleteMany({ conversationId: conversation._id });
    await Conversation.findByIdAndDelete(conversation._id);

    getIo().to(conversationId).emit("group-deleted", { conversationId });
    (conversation.formerMembers || []).forEach((fm: any) => {
      getIo().to(fm.userId.toString()).emit("group-deleted", { conversationId });
    });

    return res.status(200).json({ message: "Group deleted" });
  } catch (error) {
    console.error("Error deleting group", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * PATCH /api/conversations/:conversationId/settings { theme?, quickEmoji? }
 * Theme chat + quick emoji dùng chung cho mọi thành viên, giống Messenger.
 */
export const updateConversationSettings = async (req: any, res: any) => {
  try {
    const { conversationId } = req.params;
    const { theme, quickEmoji } = req.body ?? {};
    const userId = req.user._id.toString();

    if (theme === undefined && quickEmoji === undefined) {
      return res.status(400).json({ message: "No changes provided" });
    }
    if (theme !== undefined && !CHAT_THEME_IDS.includes(theme)) {
      return res.status(400).json({ message: "Invalid theme" });
    }
    if (quickEmoji !== undefined && !isValidEmoji(quickEmoji)) {
      return res.status(400).json({ message: "Invalid emoji" });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const isMember = (conversation.participants || []).some(
      (p: any) => p.userId.toString() === userId
    );
    if (!isMember) {
      return res.status(403).json({ message: "You are not in this conversation" });
    }

    if (theme !== undefined) conversation.theme = theme;
    if (quickEmoji !== undefined) conversation.quickEmoji = quickEmoji;
    await conversation.save();

    const payload = {
      conversationId,
      theme: conversation.theme,
      quickEmoji: conversation.quickEmoji,
      updatedBy: userId,
    };
    getIo().to(conversationId).emit("conversation-settings-updated", payload);

    return res.status(200).json(payload);
  } catch (error) {
    console.error("Error updating conversation settings", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
