import Conversation from "../models/Conversation.ts";
import Message from "../models/Message.ts";
import { getIo } from "../socket/index.ts";

/**
 * Shape a conversation doc for the client: populated active participants,
 * formerMembers (people who left) and a plain-object unreadCounts.
 *
 * When `viewerId` is given and that viewer has left the group, the result is
 * frozen at the moment they left: messages sent afterwards (lastMessage) are
 * hidden so a leaver can keep their old history without peeking at new chat.
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
        .json({ message: "Loại cuộc trò chuyện và danh sách thành viên là bắt buộc" });
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
        // Custom name supplied — use it directly.
        groupPayload = { name: name.trim(), createdBy: userId };
      } else {
        // No name supplied. Build the doc without a group.name yet; after save we
        // populate the creator's displayName from the participants array and set
        // the default "Group chat of {creator} #{shortId}".
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
      return res.status(400).json({ message: "Conversation type không hợp lệ" });
    }

    // Populate the conversation so the response carries displayName/avatarUrl for
    // participants, formerMembers and the last-message sender.
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
    console.error("Lỗi khi tạo conversation", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const getConversations = async (req: any, res: any) => {
  try {
    const userId = req.user._id;
    // Active members see the live chat; members who left keep the conversation
    // in their list so they can still open their old history.
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
    console.error("Lỗi xảy ra khi lấy conversations", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const getMessages = async (req:any, res:any) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, cursor } = req.query;
    const userId = req.user._id.toString();

    const conversation = await Conversation.findById(conversationId).lean();

    if (!conversation) {
      return res.status(404).json({ message: "Conversation không tồn tại" });
    }

    const isMember = (conversation.participants || []).some(
      (p: any) => p.userId.toString() === userId
    );
    const myLeave = (conversation.formerMembers || []).find(
      (fm: any) => fm.userId.toString() === userId
    );

    if (!isMember && !myLeave) {
      return res.status(403).json({
        message: "Bạn không có quyền xem cuộc trò chuyện này",
      });
    }

    const query: any = { conversationId };

    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }

    // A member who left only sees history up to the moment they left —
    // messages sent after that stay invisible to them.
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
    console.error("Lỗi xảy ra khi lấy messages", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
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
    console.error("Lỗi khi fetch conversations: ", error);
    return [];
  }
};

export const markAsSeen = async (req:any, res:any) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id.toString();

    const conversation = await Conversation.findById(conversationId).lean();

    if (!conversation) {
      return res.status(404).json({ message: "Conversation không tồn tại" });
    }

    const last = conversation.lastMessage;

    if (!last) {
      return res.status(200).json({ message: "Không có tin nhắn để mark as seen" });
    }

    if (last.senderId?.toString() === userId) {
      return res.status(200).json({ message: "Sender không cần mark as seen" });
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
    console.error("Lỗi khi mark as seen", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

/**
 * Leave a group chat. The leaver is moved out of `participants` into
 * `formerMembers` (with leftAt) so they keep reading history up to that point,
 * but no longer receive new messages from the group.
 */
export const leaveConversation = async (req: any, res: any) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation không tồn tại" });
    }

    if (conversation.type !== "group") {
      return res.status(400).json({ message: "Chỉ có thể rời khỏi nhóm chat" });
    }

    const isMember = (conversation.participants || []).some(
      (p: any) => p.userId.toString() === userId.toString()
    );

    if (!isMember) {
      return res.status(400).json({ message: "Bạn không ở trong group này." });
    }

    const wasCreator =
      conversation.group?.createdBy?.toString() === userId.toString();

    conversation.participants = conversation.participants.filter(
      (p: any) => p.userId.toString() !== userId.toString()
    );
    conversation.formerMembers = conversation.formerMembers || [];
    conversation.formerMembers.push({ userId, leftAt: new Date() });

    // If the creator leaves, the earliest-joined remaining member takes over
    // as owner (gains the right to delete the group). If nobody is left, the
    // creator keeps ownership so they can still delete the orphaned group.
    if (wasCreator && conversation.participants.length > 0) {
      const [nextOwner] = [...conversation.participants].sort(
        (a: any, b: any) =>
          new Date(a.joinAt ?? 0).getTime() - new Date(b.joinAt ?? 0).getTime()
      );

      if (nextOwner) {
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

    // Members keep the live view; the leaver's view is frozen at leftAt.
    const memberView = serializeConversation(conversation);
    const leaverView = serializeConversation(conversation, userId);

    // Everyone still in the room (including this leaver's open sockets).
    getIo().to(conversationId).emit("group-member-left", {
      conversationId,
      userId,
      conversation: memberView,
    });
    // The leaver's other devices listen on their personal room.
    getIo().to(userId.toString()).emit("group-left", {
      conversationId,
      conversation: leaverView,
    });

    return res.status(200).json({
      message: "Bạn đã rời khỏi nhóm",
      conversation: leaverView,
    });
  } catch (error) {
    console.error("Lỗi khi rời khỏi nhóm", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

/**
 * Delete a group chat. Only the user who created the group can delete it.
 * Removes the conversation and all of its messages, then tells every member
 * (and former member) so their clients drop the conversation.
 */
export const deleteConversation = async (req: any, res: any) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation không tồn tại" });
    }

    if (conversation.type !== "group") {
      return res.status(400).json({ message: "Chỉ có thể xóa nhóm chat" });
    }

    if (conversation.group?.createdBy?.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Chỉ người tạo nhóm mới có thể xóa nhóm" });
    }

    await Message.deleteMany({ conversationId: conversation._id });
    await Conversation.findByIdAndDelete(conversation._id);

    getIo().to(conversationId).emit("group-deleted", { conversationId });
    (conversation.formerMembers || []).forEach((fm: any) => {
      getIo().to(fm.userId.toString()).emit("group-deleted", { conversationId });
    });

    return res.status(200).json({ message: "Nhóm đã được xóa" });
  } catch (error) {
    console.error("Lỗi khi xóa nhóm", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};