import crypto from "crypto";

export const CLOUDINARY_FOLDER = "chatapp";

type ResourceType = "image" | "video" | "raw";

const getConfig = () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary is not configured");
  }
  return { cloud: CLOUDINARY_CLOUD_NAME, apiKey: CLOUDINARY_API_KEY, secret: CLOUDINARY_API_SECRET };
};

// Gọi có ký phía server: API secret không bao giờ rời khỏi backend.
const signedPost = async (
  resourceType: ResourceType,
  action: "upload" | "destroy",
  params: Record<string, string>,
  file?: Blob,
  fileName?: string
) => {
  const { cloud, apiKey, secret } = getConfig();
  const signed = { ...params, timestamp: String(Math.floor(Date.now() / 1000)) };
  const toSign = Object.keys(signed)
    .sort()
    .map((key) => `${key}=${signed[key]}`)
    .join("&");
  const signature = crypto.createHash("sha1").update(toSign + secret).digest("hex");

  const form = new FormData();
  Object.entries(signed).forEach(([key, value]) => form.append(key, value));
  form.append("api_key", apiKey);
  form.append("signature", signature);
  if (file) form.append("file", file, fileName || "attachment");

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/${action}`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Cloudinary ${action} failed (${res.status})`);
  }
  return data;
};

const resourceTypeOf = (mime: string): ResourceType =>
  mime.startsWith("image/") ? "image" : mime.startsWith("audio/") || mime.startsWith("video/") ? "video" : "raw";

export const uploadToCloudinary = async (file: Express.Multer.File, ext: string) => {
  const resourceType = resourceTypeOf(file.mimetype);
  // File raw chỉ giữ phần mở rộng nếu nó nằm trong public_id.
  const publicId = `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${resourceType === "raw" && ext ? "." + ext : ""}`;
  const data = await signedPost(
    resourceType,
    "upload",
    { folder: CLOUDINARY_FOLDER, public_id: publicId },
    new Blob([file.buffer], { type: file.mimetype }),
    file.originalname
  );
  return { url: data.secure_url as string, publicId };
};

const parseCloudinaryUrl = (value: unknown) => {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (typeof value !== "string" || !cloud) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") return null;
    const match = new RegExp(
      `^/${cloud}/(image|video|raw)/upload/v\\d+/(${CLOUDINARY_FOLDER}/[A-Za-z0-9._-]+)$`
    ).exec(url.pathname);
    if (!match) return null;
    const resourceType = match[1] as ResourceType;
    // public_id của ảnh/video không có phần mở rộng; của file raw thì có.
    const publicId = resourceType === "raw" ? match[2] : match[2].replace(/\.[^./]+$/, "");
    return { resourceType, publicId };
  } catch {
    return null;
  }
};

/**
 * Chỉ file đã upload lên cloud/folder Cloudinary của mình mới được lưu vào tin nhắn,
 * reaction hoặc custom emoji. Đồng thời chặn URL javascript:/data:.
 */
export const isUploadedAttachmentUrl = (value: unknown): value is string =>
  parseCloudinaryUrl(value) !== null;

/** Best effort: xóa thất bại chỉ được log, không bao giờ chặn caller. */
export const deleteCloudinaryFiles = async (urls: unknown[]) => {
  const targets = urls.map(parseCloudinaryUrl).filter((t) => t !== null);
  const results = await Promise.allSettled(
    targets.map(({ resourceType, publicId }) =>
      // invalidate xóa cache CDN để URL cũ không còn phục vụ file.
      signedPost(resourceType, "destroy", { public_id: publicId, invalidate: "true" })
    )
  );
  results.forEach((r) => {
    if (r.status === "rejected") console.error("Error deleting Cloudinary file:", r.reason);
  });
};
