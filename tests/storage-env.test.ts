import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { env, hasR2Config, MAX_BROWSER_UPLOAD_BYTES } from "@/lib/env";
import { MAX_BROWSER_UPLOAD_BYTES as CONST_MAX_BYTES } from "@/lib/upload-constants";
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
