import mongoose from "mongoose";

export const MAX_CUSTOM_EMOJIS = 50;

const customEmojiSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 32 },
    imgUrl: { type: String, required: true },
  },
  { timestamps: true }
);

const CustomEmoji = mongoose.model("CustomEmoji", customEmojiSchema);

export default CustomEmoji;
