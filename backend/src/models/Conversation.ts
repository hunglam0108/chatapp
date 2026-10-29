import mongoose from "mongoose";
import { DEFAULT_QUICK_EMOJI } from "../utils/emojiHelper.ts";

// Giữ đồng bộ với frontend/lib/chat-themes.ts.
export const CHAT_THEME_IDS = ["default", "ocean", "sunset", "forest", "rose", "midnight"];

const participantSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    joinAt: {
        type: Date,
        default: Date.now
    }
},{
    _id: false
})

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    _id: false,
  }
)

// Thành viên đã rời nhóm: vẫn đọc được lịch sử tới thời điểm `leftAt`,
// nhưng không còn nhận tin nhắn mới.
const formerMemberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    leftAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const lastMessageSchema = new mongoose.Schema(
  {
    _id: { type: String },
    content: {
      type: String,
      default: null,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdAt: {
      type: Date,
      default: null,
    },
    recalled: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  }
);

const conversationSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['direct', 'group'],
        required: true
    },
    participants: {
        type: [participantSchema],
        required: true
    },
    group: {
        type: groupSchema
    },
    formerMembers: {
        type: [formerMemberSchema],
        default: [],
    },
    // Lưu ý: senderId/content thuộc collection Message. Tin nhắn cuối
    // của cuộc trò chuyện được lưu trong `lastMessage` (kèm người gửi).
    lastMessageAt: {
        type:  Date
    },
    lastMessage: {
        type: lastMessageSchema
    },
    seenBy: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ],
    imgUrl: String,
    theme: {
        type: String,
        enum: CHAT_THEME_IDS,
        default: "default"
    },
    quickEmoji: {
        type: String,
        default: DEFAULT_QUICK_EMOJI
    },
    unreadCounts: {
        type: Map,
        of: Number,
        default: {}
    }
}, { 
    timestamps: true 
});

conversationSchema.index({ "participants.userId": 1, lastMessageAt: -1 })
conversationSchema.index({ "formerMembers.userId": 1 })

// Tiện ích tạo tên mặc định "Group chat of {creator} #{shortId}".
export const defaultGroupName = (creatorDisplayName: string) =>
  `Group chat of ${creatorDisplayName} #${Math.random().toString(36).slice(2, 7)}`;

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
