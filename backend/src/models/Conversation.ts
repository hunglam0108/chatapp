import mongoose from "mongoose";

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

// A member who left the group: they can still read history up to `leftAt`,
// but they no longer receive new messages.
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
    formerMembers: {
        type: [formerMemberSchema],
        default: [],
    },
    // Note: senderId/content belong to the Message collection. The last
    // message of a conversation is stored in `lastMessage` (with its sender).
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

// Utility for the "Group chat of {creator} #{shortId}" default name.
export const defaultGroupName = (creatorDisplayName: string) =>
  `Group chat of ${creatorDisplayName} #${Math.random().toString(36).slice(2, 7)}`;

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
