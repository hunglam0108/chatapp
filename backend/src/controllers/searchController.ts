import User from "../models/User.ts";
import Friend from "../models/Friend.ts";
import FriendRequest from "../models/FriendRequest.ts";
import type { Request, Response } from "express";

const escapeRegex = (input: string) =>
  input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * GET /api/user/search?query=xxx
 * Finds users by username or displayName (case-insensitive partial match),
 * annotated with the relationship to the current user so the frontend can
 * hide/disable the "add friend" action accordingly.
 */
export const searchUsers = async (req: any, res: any) => {
  try {
    const raw = (req.query.query ?? "").toString().trim();
    if (!raw) {
      return res.status(200).json({ users: [] });
    }

    const limitRaw = (req.query.limit ?? 10).toString();
    const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 10, 1), 50);

    const userId = req.user._id.toString();
    const pattern = new RegExp(escapeRegex(raw), "i");

    const [users, friendships, requests] = await Promise.all([
      User.find({
        $or: [{ username: pattern }, { displayName: pattern }],
      })
        .select("_id username displayName avatarUrl")
        .limit(limit)
        .lean(),
      Friend.find({
        $or: [{ userA: userId }, { userB: userId }],
      })
        .select("userA userB")
        .lean(),
      FriendRequest.find({
        $or: [{ from: userId }, { to: userId }],
      })
        .select("_id from to")
        .lean(),
    ]);

    const friendIds = new Set(
      friendships.map((f) => {
        const a = f.userA.toString();
        const b = f.userB.toString();
        return a === userId ? b : a;
      })
    );

    // requestId -> { otherUserId, direction }
    const requestByOther = new Map<
      string,
      { requestId: string; direction: "sent" | "received" }
    >();
    requests.forEach((r) => {
      const fromId = r.from.toString();
      const toId = r.to.toString();
      if (fromId === userId) {
        requestByOther.set(toId, { requestId: r._id.toString(), direction: "sent" });
      } else {
        requestByOther.set(fromId, {
          requestId: r._id.toString(),
          direction: "received",
        });
      }
    });

    const usersWithRelation = users.map((u) => {
      const id = u._id.toString();
      let relation: "self" | "friend" | "request_sent" | "request_received" | "none" =
        "none";
      let requestId: string | undefined;

      if (id === userId) {
        relation = "self";
      } else if (friendIds.has(id)) {
        relation = "friend";
      } else if (requestByOther.has(id)) {
        const pending = requestByOther.get(id)!;
        relation =
          pending.direction === "sent" ? "request_sent" : "request_received";
        requestId = pending.requestId;
      }

      return {
        _id: id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl ?? null,
        relation,
        requestId,
      };
    });

    return res.status(200).json({ users: usersWithRelation });
  } catch (error) {
    console.error("Lỗi khi tìm kiếm người dùng", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
