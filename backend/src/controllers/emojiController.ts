import CustomEmoji, { MAX_CUSTOM_EMOJIS } from "../models/CustomEmoji.ts";
import { isUploadedAttachmentUrl } from "../utils/cloudinary.ts";

export const getMyEmojis = async (req: any, res: any) => {
  try {
    const emojis = await CustomEmoji.find({ ownerId: req.user._id }).sort({
      createdAt: 1,
    });
    return res.status(200).json({ emojis });
  } catch (error) {
    console.error("Error fetching emojis", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createEmoji = async (req: any, res: any) => {
  try {
    const ownerId = req.user._id;
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const { imgUrl } = req.body ?? {};

    if (!/^[\p{L}\p{N}_-]{1,32}$/u.test(name)) {
      return res
        .status(400)
        .json({ message: "Emoji name must be 1-32 characters: letters, numbers, _ or -" });
    }
    if (!isUploadedAttachmentUrl(imgUrl)) {
      return res.status(400).json({ message: "Invalid emoji image" });
    }

    const count = await CustomEmoji.countDocuments({ ownerId });
    if (count >= MAX_CUSTOM_EMOJIS) {
      return res
        .status(400)
        .json({ message: `Up to ${MAX_CUSTOM_EMOJIS} emojis per account` });
    }

    const emoji = await CustomEmoji.create({ ownerId, name, imgUrl });
    return res.status(201).json({ emoji });
  } catch (error) {
    console.error("Error creating emoji", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteEmoji = async (req: any, res: any) => {
  try {
    const deleted = await CustomEmoji.findOneAndDelete({
      _id: req.params.emojiId,
      ownerId: req.user._id,
    });
    if (!deleted) {
      return res.status(404).json({ message: "Emoji not found" });
    }
    return res.status(200).json({ message: "Emoji deleted" });
  } catch (error) {
    console.error("Error deleting emoji", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
