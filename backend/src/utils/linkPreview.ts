import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import Message from "../models/Message.ts";
import { getIo } from "../socket/index.ts";

const TIMEOUT_MS = 5000;
const MAX_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 3;

// Chống SSRF: không cho server fetch vào mạng nội bộ / loopback / metadata cloud.
const blocked = new net.BlockList();
[
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4],
].forEach(([ip, prefix]) => blocked.addSubnet(ip as string, prefix as number, "ipv4"));
[
  // IPv4-mapped (::ffff:a.b.c.d) được BlockList tự đối chiếu với các rule IPv4 ở trên.
  ["::", 128], ["::1", 128], ["64:ff9b::", 96],
  ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
].forEach(([ip, prefix]) => blocked.addSubnet(ip as string, prefix as number, "ipv6"));

export const isBlockedAddress = (address: string) => {
  const family = net.isIP(address);
  if (!family) return true;
  return blocked.check(address, family === 6 ? "ipv6" : "ipv4");
};

// Kiểm tra IP ngay trong bước resolve DNS của socket để tránh DNS rebinding.
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) {
      return callback(new Error("Blocked address"), "", 0);
    }
    if ((options as dns.LookupOptions).all) {
      return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, addresses);
    }
    callback(null, addresses[0].address, addresses[0].family);
  });
};

const isAllowedUrl = (url: URL) => {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.port) return false; // chỉ port mặc định 80/443
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // IP literal không đi qua lookup nên phải tự kiểm tra.
  return !net.isIP(host) || !isBlockedAddress(host);
};

const fetchHtml = (url: URL, redirectsLeft = MAX_REDIRECTS): Promise<{ html: string; url: URL } | null> =>
  new Promise((resolve) => {
    if (!isAllowedUrl(url)) return resolve(null);

    const client = url.protocol === "https:" ? https : http;
    const req = client.get(
      url,
      {
        lookup: safeLookup,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; KuroChatLinkPreview/1.0)",
          accept: "text/html,application/xhtml+xml",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) return resolve(null);
          try {
            return resolve(fetchHtml(new URL(res.headers.location, url), redirectsLeft - 1));
          } catch {
            return resolve(null);
          }
        }
        if (status !== 200 || !String(res.headers["content-type"]).includes("html")) {
          res.resume();
          return resolve(null);
        }

        const chunks: Buffer[] = [];
        let size = 0;
        const done = () => resolve({ html: Buffer.concat(chunks).toString("utf8"), url });
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          size += chunk.length;
          // Thẻ og: nằm trong <head>, đọc tới giới hạn là đủ.
          if (size >= MAX_BYTES) {
            res.destroy();
            done();
          }
        });
        res.on("end", done);
        res.on("error", () => resolve(null));
      }
    );
    req.on("error", () => resolve(null));
  });

const decodeEntities = (text: string) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

const clean = (text: string | undefined, max: number) => {
  const value = text ? decodeEntities(text).replace(/\s+/g, " ").trim() : "";
  return value ? value.slice(0, max) : undefined;
};

export const parsePreview = (html: string, pageUrl: URL) => {
  const meta = new Map<string, string>();
  for (const tag of html.match(/<meta\s[^>]*>/gi) ?? []) {
    const attrs = Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((m) => [
        m[1].toLowerCase(),
        m[2] ?? m[3],
      ])
    );
    const key = (attrs.property || attrs.name)?.toLowerCase();
    if (key && attrs.content && !meta.has(key)) meta.set(key, attrs.content);
  }

  const title = clean(
    meta.get("og:title") ?? meta.get("twitter:title") ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1],
    200
  );
  const description = clean(
    meta.get("og:description") ?? meta.get("twitter:description") ?? meta.get("description"),
    300
  );
  if (!title && !description) return null;

  let image: string | undefined;
  const rawImage = meta.get("og:image") ?? meta.get("twitter:image");
  if (rawImage) {
    try {
      const resolved = new URL(decodeEntities(rawImage), pageUrl);
      if (resolved.protocol === "https:" || resolved.protocol === "http:") image = resolved.href;
    } catch {
      // ảnh không hợp lệ: bỏ qua
    }
  }

  return {
    url: pageUrl.href,
    title,
    description,
    image,
    siteName: clean(meta.get("og:site_name"), 100) ?? pageUrl.hostname.replace(/^www\./, ""),
  };
};

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;

export const extractFirstUrl = (content: unknown) => {
  if (typeof content !== "string") return null;
  const match = content.match(URL_PATTERN)?.[0].replace(/[.,!?;:)\]}]+$/, "");
  return match ?? null;
};

export const fetchLinkPreview = async (rawUrl: string) => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const page = await fetchHtml(url);
  return page ? parsePreview(page.html, page.url) : null;
};

/** Best effort, chạy sau khi đã trả response: gắn preview cho link đầu tiên rồi báo cho room. */
export const attachLinkPreview = async (message: { _id: unknown; content?: string | null }) => {
  const url = extractFirstUrl(message.content);
  if (!url) return;
  try {
    const linkPreview = await fetchLinkPreview(url);
    if (!linkPreview) return;
    // Chỉ cập nhật nếu tin chưa bị sửa/thu hồi trong lúc fetch.
    const updated = await Message.findOneAndUpdate(
      { _id: message._id, content: message.content, recalledAt: null },
      { linkPreview },
      { returnDocument: "after" }
    );
    if (updated) {
      getIo().to(updated.conversationId.toString()).emit("message-updated", { message: updated });
    }
  } catch (error) {
    console.error("Error attaching link preview:", error);
  }
};
