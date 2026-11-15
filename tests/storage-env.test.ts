import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { env, hasR2Config, MAX_BROWSER_UPLOAD_BYTES } from "@/lib/env";
import {
  MAX_BROWSER_UPLOAD_BYTES as CONST_MAX_BYTES,
  isAllowedNextImageSrc,
  isSafeRasterImageMimeOrExt,
} from "@/lib/upload-constants";
import { MediaAssetPurpose } from "@prisma/client";
import type { BookingFile, MediaAsset } from "@prisma/client";
import nextConfig from "../next.config";

test("lib/env exposes Cloudflare R2 configuration & next.config allows R2 & Google avatars", () => {
  assert.equal(typeof env.r2KeyPrefix, "string");
  assert.ok(env.r2KeyPrefix.length > 0);
  assert.equal(typeof hasR2Config(), "boolean");
  const patterns = nextConfig.images?.remotePatterns ?? [];
  const hosts = patterns.map((p) => ("hostname" in p ? p.hostname : ""));
  assert.ok(hosts.some((h) => h.endsWith(".r2.dev") || h.includes("r2.dev")));
  assert.ok(hosts.includes("lh3.googleusercontent.com"));
});

test("MAX_BROWSER_UPLOAD_BYTES is 4MB in upload-constants and re-exported from lib/env", () => {
  assert.equal(MAX_BROWSER_UPLOAD_BYTES, 4 * 1024 * 1024);
  assert.equal(CONST_MAX_BYTES, 4 * 1024 * 1024);
});

test("hasR2Config validates presence of required fields and rejects placeholders", () => {
  assert.equal(
    hasR2Config({
      r2AccountId: "your-account-id",
      r2AccessKeyId: "key",
      r2SecretAccessKey: "secret",
      r2BucketName: "bucket",
    }),
    false,
    "should reject placeholder account id"
  );

  assert.equal(
    hasR2Config({
      r2AccountId: "123456",
      r2AccessKeyId: "changeme",
      r2SecretAccessKey: "secret",
      r2BucketName: "bucket",
    }),
    false,
    "should reject changeme access key"
  );

  assert.equal(
    hasR2Config({
      r2AccountId: "123456",
      r2AccessKeyId: "key",
      r2SecretAccessKey: "secret",
      r2BucketName: "example-bucket",
    }),
    false,
    "should reject example bucket name"
  );

  assert.equal(
    hasR2Config({
      r2AccountId: "your-account-id",
      r2Endpoint: "https://your-account-id.r2.cloudflarestorage.com",
      r2AccessKeyId: "key",
      r2SecretAccessKey: "secret",
      r2BucketName: "my-bucket",
    }),
    false,
    "should reject placeholder inside endpoint URL"
  );

  assert.equal(
    hasR2Config({
      r2AccountId: "",
      r2Endpoint: "https://replace-with-account-id.r2.cloudflarestorage.com",
      r2AccessKeyId: "key",
      r2SecretAccessKey: "secret",
      r2BucketName: "my-bucket",
    }),
    false,
    "should reject empty account id with placeholder endpoint"
  );

  assert.equal(
    hasR2Config({
      r2AccountId: "123456",
      r2AccessKeyId: "key",
      r2SecretAccessKey: "secret",
      r2BucketName: "my-bucket",
    }),
    true,
    "should accept valid config"
  );
});

test("env.r2KeyPrefix has no leading or trailing slashes", () => {
  assert.ok(!env.r2KeyPrefix.startsWith("/"));
  assert.ok(!env.r2KeyPrefix.endsWith("/"));
});

test("Prisma schema exports MediaAssetPurpose and updated BookingFile/MediaAsset shapes", () => {
  assert.deepEqual(Object.values(MediaAssetPurpose).sort(), [
    "CREATOR_PORTFOLIO_DOCUMENT",
    "CREATOR_PORTFOLIO_IMAGE",
    "EDITORIAL_ASSET",
    "GENERAL",
    "USER_AVATAR",
  ]);

  // Static type assertion check for BookingFile R2 fields
  const sampleBookingFile: Partial<BookingFile> = {
    storageProvider: "R2",
    bucket: "tovolana-assets",
    etag: "etag-123",
    revisionId: "rev-123",
    disputeId: null,
  };
  assert.equal(sampleBookingFile.storageProvider, "R2");

  // Static type assertion check for MediaAsset model
  const sampleMediaAsset: Partial<MediaAsset> = {
    id: "asset-123",
    ownerId: "user-123",
    purpose: MediaAssetPurpose.USER_AVATAR,
    fileName: "avatar.png",
    mimeType: "image/png",
    sizeBytes: 1024,
    storageProvider: "R2",
    bucket: "tovolana-assets",
    storageKey: "avatars/asset-123-avatar.png",
    publicUrl: "https://pub.r2.dev/avatars/asset-123-avatar.png",
    etag: "etag-abc",
  };
  assert.equal(sampleMediaAsset.purpose, MediaAssetPurpose.USER_AVATAR);
});

test("isAllowedNextImageSrc and isSafeRasterImageMimeOrExt prevent next/image host & SVG crashes", () => {
  assert.equal(
    isAllowedNextImageSrc("https://other-bucket.r2.dev/sample.png"),
    false
  );
  assert.equal(isAllowedNextImageSrc("/images/photo.jpg?v=1"), false);
  assert.equal(isAllowedNextImageSrc("/images/photo.jpg"), true);
  assert.equal(
    isAllowedNextImageSrc(
      "https://pub-cc07856d657b4a7197710051042b3eda.r2.dev/tovolana_writers/media/avatars/u1/a.png"
    ),
    true
  );
  assert.equal(isAllowedNextImageSrc("/api/media/abc/raw"), true);
  assert.equal(
    isSafeRasterImageMimeOrExt(
      "image/svg+xml",
      "https://pub-cc07856d657b4a7197710051042b3eda.r2.dev/x.svg"
    ),
    false
  );
});

