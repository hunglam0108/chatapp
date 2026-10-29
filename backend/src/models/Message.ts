import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
        required: true,
        index: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    content: {
        type: String,
        trim: true
    },
    imgUrl: String,
    // Đính kèm voice note / audio / file thông thường (mỗi file < 10MB).
    audioUrl: String,
    fileUrl: String,
    fileMeta: {
        name: String,      // tên file gốc của tin nhắn dạng file
        size: Number,      // đơn vị byte
        mimetype: String,
    },
    // Custom emoji gửi riêng lẻ, hiển thị dạng sticker.
    stickerUrl: String,
    editedAt: Date,
    // Bị người gửi thu hồi: xóa nội dung và đính kèm, chỉ giữ placeholder.
    recalledAt: Date,
    // Mỗi user một reaction (gửi lại cùng emoji sẽ bỏ reaction).
    reactions: {
        type: [
            new mongoose.Schema({
                userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
                emoji: { type: String, required: true },
            }, { _id: false })
        ],
        default: []
    }
}, { 
    timestamps: true 
});

messageSchema.index({ conversationId: 1, createdAt: -1 })

const Message = mongoose.model("Message", messageSchema);

export default Message;