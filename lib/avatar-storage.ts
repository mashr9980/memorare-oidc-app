import "server-only";
import { createHash } from "crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { avatarKey } from "./avatar-rules";

export const SIGNED_URL_TTL_SECONDS = 300;

let client: S3Client | null = null;

export function bucket(): string | null {
  return process.env.AVATAR_BUCKET?.trim() || null;
}

export function storageConfigured(): boolean {
  return bucket() !== null;
}

function s3(): S3Client {
  if (!client) client = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
  return client;
}

export async function putAvatar(sub: string, body: Uint8Array): Promise<string> {
  const name = bucket();
  if (!name) throw new Error("avatar_storage_not_configured");
  await s3().send(
    new PutObjectCommand({
      Bucket: name,
      Key: avatarKey(sub),
      Body: body,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
      ServerSideEncryption: "AES256",
    })
  );
  return createHash("sha256").update(body).digest("hex").slice(0, 12);
}

export async function avatarDownloadUrl(sub: string): Promise<string> {
  const name = bucket();
  if (!name) throw new Error("avatar_storage_not_configured");
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: name, Key: avatarKey(sub) }), {
    expiresIn: SIGNED_URL_TTL_SECONDS,
  });
}

export async function deleteAvatar(sub: string): Promise<void> {
  const name = bucket();
  if (!name) throw new Error("avatar_storage_not_configured");
  await s3().send(new DeleteObjectCommand({ Bucket: name, Key: avatarKey(sub) }));
}
