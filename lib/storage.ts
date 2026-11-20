import { createHash, createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { newId, query } from "./db";

export type UploadedMedia = {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  url: string;
  kind: "VIDEO" | "IMAGE";
  createdAt: string;
};

const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const looksLikeVideo = (buf: Buffer, mime: string) => {
  if (mime === "video/mp4") return buf.subarray(4, 8).toString("ascii") === "ftyp";
  if (mime === "video/webm") return buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
  return false;
};

const looksLikeImage = (buf: Buffer, mime: string) => {
  if (mime === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === "image/png") return buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === "image/webp") return buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
};

export async function storeUploadedFile(file: File, kind: "VIDEO" | "IMAGE", uploadedBy: string): Promise<UploadedMedia> {
  const mime = file.type;
  const allowed = kind === "VIDEO" ? VIDEO_TYPES : IMAGE_TYPES;
  if (!(mime in allowed)) {
    throw new Error(
      kind === "VIDEO" ? "Unsupported video type. Upload MP4 or WebM." : "Unsupported image type. Upload JPEG, PNG or WebP.",
    );
  }
  const max = kind === "VIDEO" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size <= 0) throw new Error("The uploaded file is empty.");
  if (file.size > max) throw new Error(`File too large. Maximum size is ${Math.round(max / 1024 / 1024)} MB.`);

  const buffer = Buffer.from(await file.arrayBuffer());
  const valid = kind === "VIDEO" ? looksLikeVideo(buffer, mime) : looksLikeImage(buffer, mime);
  if (!valid) throw new Error("The file contents do not match the declared file type.");

  const id = newId("med");
  const ext = allowed[mime];
  const storageKey = `${kind.toLowerCase()}/${id}.${ext}`;
  const safeOriginal = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || `${id}.${ext}`;

  let url: string;
  if (process.env.MEDIA_STORAGE === "s3") {
    url = await s3Put(storageKey, buffer, mime);
  } else {
    const dir = path.resolve(process.env.MEDIA_DIR ?? "./storage/uploads");
    const target = path.join(dir, storageKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buffer);
    url = `/api/media/${id}`;
  }

  await query(
    `INSERT INTO uploaded_media (id, filename, original_name, mime_type, size_bytes, storage_key, url, kind, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, `${id}.${ext}`, safeOriginal, mime, file.size, storageKey, url, kind, uploadedBy],
  );

  return {
    id,
    filename: `${id}.${ext}`,
    originalName: safeOriginal,
    mimeType: mime,
    sizeBytes: file.size,
    storageKey,
    url,
    kind,
    createdAt: new Date().toISOString(),
  };
}

export function mediaFilePath(storageKey: string) {
  const base = path.resolve(process.env.MEDIA_DIR ?? "./storage/uploads");
  const target = path.resolve(base, storageKey);
  if (!target.startsWith(base)) throw new Error("Invalid media path");
  return target;
}

/* ------------------------- S3-compatible adapter ------------------------- */

const sha256Hex = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data).digest();

/**
 * Minimal AWS Signature V4 PUT for S3-compatible storage (AWS S3, Cloudflare R2,
 * Backblaze B2). Buckets must expose the media through S3_PUBLIC_BASE_URL.
 */
async function s3Put(key: string, body: Buffer, contentType: string) {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY_ID;
  const secretKey = process.env.S3_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION ?? "auto";
  const publicBase = process.env.S3_PUBLIC_BASE_URL;
  if (!endpoint || !bucket || !accessKey || !secretKey || !publicBase) {
    throw new Error(
      "S3 storage is selected but S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_PUBLIC_BASE_URL are not fully configured.",
    );
  }
  const base = new URL(endpoint);
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const canonicalUri = `/${bucket}/${encodedKey}`;
  const host = base.host;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const canonicalHeaders =
    `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `PUT\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256Hex(canonicalRequest)}`;
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`${base.origin}${canonicalUri}`, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    throw new Error(`Media storage rejected the upload (HTTP ${res.status}). Check storage credentials.`);
  }
  return `${publicBase.replace(/\/$/, "")}/${encodedKey}`;
}
