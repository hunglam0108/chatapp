import Friend from "../models/Friend.ts";
import User from "../models/User.ts";
import FriendRequest from "../models/FriendRequest.ts";
import { getIo } from "../socket/index.ts";
import type { Request, Response } from 'express';

/** Payload shape the frontend friendStore expects for received requests. */
const toRequestPayload = (request: any) => ({
  _id: request._id.toString(),
  from: request.from
    ? {
        _id: request.from._id?.toString?.() ?? request.from._id,
        username: request.from.username,
        displayName: request.from.displayName,
        avatarUrl: request.from.avatarUrl ?? null,
      }
    : undefined,
  to: request.to
    ? {
        _id: request.to._id?.toString?.() ?? request.to._id,
        username: request.to.username,
        displayName: request.to.displayName,
        avatarUrl: request.to.avatarUrl ?? null,
      }
    : undefined,
  message: request.message ?? "",
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
});

export const sendFriendRequest = async (req: Request, res: Response) => {
  try {
    const { to, message } = req.body;

    const from = req.user._id;

    if (from === to) {
      return res
        .status(400)
        .json({ message: "Không thể gửi lời mời kết bạn cho chính mình" });
    }

    const userExists = await User.exists({ _id: to });

    if (!userExists) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    let userA = from.toString();
    let userB = to.toString();

    if (userA > userB) {
      [userA, userB] = [userB, userA];
    }

    const [alreadyFriends, existingRequest] = await Promise.all([
      Friend.findOne({ userA, userB }),
      FriendRequest.findOne({
        $or: [
          { from, to },
          { from: to, to: from },
        ],
      }),
    ]);

    if (alreadyFriends) {
      return res.status(400).json({ message: "Hai người đã là bạn bè" });
    }

    if (existingRequest) {
      return res.status(400).json({ message: "Đã có lời mời kết bạn đang chờ" });
    }

    const request = await FriendRequest.create({
      from,
      to,
      message,
    });

    // Real-time: notify the receiver so their sidebar updates instantly.
    const populated = await FriendRequest.findById(request._id)
      .populate("from", "_id username displayName avatarUrl")
      .populate("to", "_id username displayName avatarUrl")
      .lean();

    getIo().to(to.toString()).emit(
      "friend-request:receive",
      toRequestPayload(populated)
    );

    return res
      .status(201)
      .json({ message: "Gửi lời mời kết bạn thành công", request: toRequestPayload(populated) });
  } catch (error) {
    console.error("Lỗi khi gửi yêu cầu kết bạn", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const acceptFriendRequest = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    const request = await FriendRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({ message: "Không tìm thấy lời mời kết bạn" });
    }

    if (request.to.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền chấp nhận lời mời này" });
    }

    const friend = await Friend.create({
      userA: request.from,
      userB: request.to,
    });

    await FriendRequest.findByIdAndDelete(requestId);

    const from = await User.findById(request.from)
      .select("_id displayName avatarUrl username")
      .lean();

    // Real-time: tell the sender their request was accepted.
    getIo().to(request.from.toString()).emit("friend-request:accepted", {
      requestId: requestId,
      newFriend: {
        _id: userId.toString(),
        username: req.user.username,
        displayName: req.user.displayName,
        avatarUrl: req.user.avatarUrl ?? null,
      },
    });

    return res.status(200).json({
      message: "Chấp nhận lời mời kết bạn thành công",
      newFriend: {
        _id: from?._id?.toString?.() ?? from?._id,
        username: from?.username,
        displayName: from?.displayName,
        avatarUrl: from?.avatarUrl ?? null,
      },
    });
  } catch (error) {
    console.error("Lỗi khi chấp nhận lời mời kết bạn", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const declineFriendRequest = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    const request = await FriendRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({ message: "Không tìm thấy lời mời kết bạn" });
    }

    if (request.to.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền từ chối lời mời này" });
    }

    await FriendRequest.findByIdAndDelete(requestId);

    // Real-time: tell the sender their request was declined.
    getIo().to(request.from.toString()).emit("friend-request:declined", {
      requestId: requestId,
    });

    return res.sendStatus(204);
  } catch (error) {
    console.error("Lỗi khi từ chối lời mời kết bạn", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const getAllFriends = async (req: Request, res: Response) => {
  try {
    const userId = req.user._id;

    const friendships = await Friend.find({
      $or: [
        {
          userA: userId,
        },
        {
          userB: userId,
        },
      ],
    })
      .populate("userA", "_id displayName avatarUrl username")
      .populate("userB", "_id displayName avatarUrl username")
      .lean();

    if (!friendships.length) {
      return res.status(200).json({ friends: [] });
    }

    const friends = friendships.map((f) =>
      f.userA._id.toString() === userId.toString() ? f.userB : f.userA
    );

    return res.status(200).json({ friends });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách bạn bè", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const getFriendRequests = async (req: Request, res: Response) => {
  try {
    const userId = req.user._id;

    const populateFields = "_id username displayName avatarUrl";

    const [sent, received] = await Promise.all([
      FriendRequest.find({ from: userId }).populate("to", populateFields),
      FriendRequest.find({ to: userId }).populate("from", populateFields),
    ]);

    res.status(200).json({ sent, received });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách yêu cầu kết bạn", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
