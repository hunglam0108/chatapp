import Friend from "../models/Friend.ts";
import User from "../models/User.ts";
import FriendRequest from "../models/FriendRequest.ts";
import { getIo } from "../socket/index.ts";
import type { Request, Response } from 'express';

/** Dạng payload mà friendStore ở frontend mong đợi cho lời mời đã nhận. */
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
        .json({ message: "You cannot send a friend request to yourself" });
    }

    const userExists = await User.exists({ _id: to });

    if (!userExists) {
      return res.status(404).json({ message: "User not found" });
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
      return res.status(400).json({ message: "You are already friends" });
    }

    if (existingRequest) {
      return res.status(400).json({ message: "A friend request is already pending" });
    }

    const request = await FriendRequest.create({
      from,
      to,
      message,
    });

    // Real-time: báo cho người nhận để sidebar cập nhật ngay.
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
      .json({ message: "Friend request sent", request: toRequestPayload(populated) });
  } catch (error) {
    console.error("Error sending friend request", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const acceptFriendRequest = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    const request = await FriendRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    if (request.to.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "You are not allowed to accept this request" });
    }

    const friend = await Friend.create({
      userA: request.from,
      userB: request.to,
    });

    await FriendRequest.findByIdAndDelete(requestId);

    const from = await User.findById(request.from)
      .select("_id displayName avatarUrl username")
      .lean();

    // Real-time: báo cho người gửi rằng lời mời đã được chấp nhận.
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
      message: "Friend request accepted",
      newFriend: {
        _id: from?._id?.toString?.() ?? from?._id,
        username: from?.username,
        displayName: from?.displayName,
        avatarUrl: from?.avatarUrl ?? null,
      },
    });
  } catch (error) {
    console.error("Error accepting friend request", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const declineFriendRequest = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    const request = await FriendRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    if (request.to.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "You are not allowed to decline this request" });
    }

    await FriendRequest.findByIdAndDelete(requestId);

    // Real-time: báo cho người gửi rằng lời mời đã bị từ chối.
    getIo().to(request.from.toString()).emit("friend-request:declined", {
      requestId: requestId,
    });

    return res.sendStatus(204);
  } catch (error) {
    console.error("Error declining friend request", error);
    return res.status(500).json({ message: "Internal server error" });
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
    console.error("Error fetching friends", error);
    return res.status(500).json({ message: "Internal server error" });
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
    console.error("Error fetching friend requests", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
