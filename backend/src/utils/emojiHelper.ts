export const DEFAULT_QUICK_EMOJI = "👍";

/** Một chuỗi emoji ngắn (vd. "👍", "❤️", "👍🏽") — không phải văn bản tùy ý. */
export const isValidEmoji = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 16 &&
  /^[\p{Extended_Pictographic}\p{Emoji_Component}‍️]+$/u.test(value) &&
  /\p{Extended_Pictographic}/u.test(value);
