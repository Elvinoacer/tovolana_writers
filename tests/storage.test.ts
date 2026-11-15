import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { MediaAssetPurpose } from "@prisma/client";
import { env, hasR2Config } from "@/lib/env";
import {
  MAX_BROWSER_UPLOAD_BYTES,
  assertScopedStorageKey,
  buildPublicR2Url,
  createMediaStorageKey,
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  createStorageKey,
  deleteStoredObject,
  getR2KeyPrefix,
  readPrivateFile,
  readPublicLocalMedia,
  sanitizeFileName,
  sanitizePathSegment,
  signStorageAccess,
  verifyStorageAccess,
  writePrivateFile,
  writePublicMedia,
  validateBookingUploadMime,
  validateMediaUploadMime,
} from "@/lib/storage";

const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");
const PUBLIC_LOCAL_ROOT = path.resolve(UPLOADS_ROOT, "_public");

test("MAX_BROWSER_UPLOAD_BYTES is re-exported and getR2KeyPrefix is isolated", () => {
  assert.equal(MAX_BROWSER_UPLOAD_BYTES, 4 * 1024 * 1024);
  const prefix = getR2KeyPrefix();
  assert.ok(prefix.length > 0);
  assert.ok(!prefix.startsWith("/"));
  assert.ok(!prefix.endsWith("/"));
  assert.ok(!prefix.includes(".."));
});

test("sanitizeFileName and sanitizePathSegment neutralize traversal and unsafe characters", () => {
  assert.equal(sanitizeFileName("../../etc/passwd"), "passwd");
  assert.equal(sanitizeFileName("..\\..\\Windows\\System32\\cmd.exe"), "cmd.exe");
  assert.equal(sanitizeFileName(".."), "attachment.bin");
  assert.equal(sanitizeFileName("."), "attachment.bin");
  assert.equal(sanitizeFileName(""), "attachment.bin");
  assert.equal(sanitizeFileName("foo..bar\0.pdf"), "foo.bar.pdf");
  assert.equal(sanitizeFileName("payload.html."), "payload.html");
  assert.equal(sanitizeFileName("evil.svg..."), "evil.svg");
  assert.ok(!sanitizeFileName("%2e%2e%2fsecret.txt").includes(".."));
  assert.ok(!sanitizeFileName("%2e%2e%2fsecret.txt").includes("/"));

  assert.equal(sanitizePathSegment("cmwg8zrx8000vwfrq5tp1yqhg"), "cmwg8zrx8000vwfrq5tp1yqhg");
  const safeTraversal = sanitizePathSegment("../../etc/passwd");
  assert.ok(!safeTraversal.includes(".."));
  assert.ok(!safeTraversal.includes("/"));
  assert.ok(!safeTraversal.includes("\\"));
  assert.equal(sanitizePathSegment("..", "fallback"), "fallback");
  assert.equal(sanitizePathSegment("%2e%2e%2fother", "fallback").includes(".."), false);
});

test("createStorageKey and createMediaStorageKey enforce prefix isolation (Review Focus #1)", () => {
  const prefix = getR2KeyPrefix();

  const bookingKey = createStorageKey("../../other-tenant", "..\\..\\etc/passwd");
  assert.ok(bookingKey.startsWith(`${prefix}/bookings/`));
  assert.ok(!bookingKey.includes(".."));
  assert.ok(!bookingKey.includes("\\"));
  assert.equal(assertScopedStorageKey(bookingKey), bookingKey);

  const mediaKey = createMediaStorageKey("avatars", "../user-123/../../", "my avatar (1).png");
  assert.ok(mediaKey.startsWith(`${prefix}/media/avatars/`));
  assert.ok(!mediaKey.includes(".."));
  assert.ok(!mediaKey.includes("\\"));
  assert.equal(assertScopedStorageKey(mediaKey), mediaKey);
});

test("assertScopedStorageKey rejects traversal, sibling prefixes, and allows legacy LOCAL only when opted in", () => {
  const prefix = getR2KeyPrefix();
  const validKey = `${prefix}/bookings/booking123/0123456789abcdef-brief.pdf`;
  assert.equal(assertScopedStorageKey(validKey), validKey);

  const invalidKeys = [
    "",
    "   ",
    `/${validKey}`,
    `${prefix}/`,
    prefix,
    `${prefix}_evil/bookings/file.pdf`,
    "other_app/bookings/file.pdf",
    "gtss/sibling/file.pdf",
    `${prefix}/bookings/../sibling/file.pdf`,
    `${prefix}/bookings/%2e%2e/sibling/file.pdf`,
    `${prefix}/bookings/%2e%2e%2fsibling%ZZ`,
    `${prefix}/bookings/%252e%252e%252fsibling/file.pdf`,
    `${prefix}/bookings/%25252e%25252e%25252fsibling/file.pdf`,
    `${prefix}/bookings/foo%2fbar.pdf`,
    `${prefix}/bookings/foo%5cbar.pdf`,
    `${prefix}/bookings/foo%00bar.pdf`,
    `${prefix}/bookings/..\\sibling\\file.pdf`,
    `${prefix}/bookings/a\0b.txt`,
    `${prefix}/bookings//file.txt`,
    `${prefix}/bookings/./file.txt`,
    `${prefix}/bookings/file.txt/`,
    "cmwg8zrx8000vwfrq5tp1yqhg/legacy-file.txt",
  ];

  for (const bad of invalidKeys) {
    assert.throws(
      () => assertScopedStorageKey(bad),
      /INVALID_STORAGE_PATH/,
      `Expected INVALID_STORAGE_PATH for key: ${JSON.stringify(bad)}`
    );
  }

  // Legacy LOCAL pre-migration key works ONLY when allowLegacyLocal: true
  const legacyKey = "cmwg8zrx8000vwfrq5tp1yqhg/a1b2c3d4e5f6a7b8-brief.txt";
  assert.equal(assertScopedStorageKey(legacyKey, { allowLegacyLocal: true }), legacyKey);

  // Even with allowLegacyLocal: true, traversal/malformed-encoding/public-dir paths MUST fail
  for (const dangerous of [
    "../etc/passwd",
    "booking/../../etc/passwd",
    "booking/%2e%2e/secret.txt",
    "booking/%2e%2e%2fsecret%ZZ",
    "booking/%252e%252e%252fsecret.txt",
    "_public",
    `_public/${prefix}/media/avatars/user1/avatar.png`,
    "booking\\secret.txt",
    "/etc/passwd",
    "booking/file\0.txt",
    "",
  ]) {
    assert.throws(
      () => assertScopedStorageKey(dangerous, { allowLegacyLocal: true }),
      /INVALID_STORAGE_PATH/,
      `Expected INVALID_STORAGE_PATH in legacy mode for: ${JSON.stringify(dangerous)}`
    );
  }
});

test("validateBookingUploadMime blocks active XSS/executable content and accepts safe document types (Review Focus #2)", () => {
  // Blocked active/executable MIMEs
  for (const badMime of [
    "image/svg+xml",
    "image/svg+xml; charset=utf-8",
    "text/html",
    "text/html; charset=utf-8",
    "application/xhtml+xml",
    "application/javascript",
    "text/javascript",
    "application/x-msdownload",
    "application/x-sh",
  ]) {
    assert.equal(validateBookingUploadMime(badMime, "file.txt"), false, `Should reject ${badMime}`);
  }

  // Blocked extensions even with octet-stream or spoofed safe MIME (including trailing dots & XML)
  for (const badExt of [
    "payload.html",
    "payload.html.",
    "payload.HTM",
    "payload.xhtml",
    "vector.svg",
    "evil.svg.",
    "data.xml",
    "transform.xsl",
    "transform.xslt",
    "script.js",
    "module.mjs",
    "common.cjs",
    "installer.exe",
    "run.bat",
    "deploy.sh",
    "setup.ps1",
    "shell.php",
  ]) {
    assert.equal(
      validateBookingUploadMime("application/octet-stream", badExt),
      false,
      `Should reject octet-stream with ${badExt}`
    );
    assert.equal(
      validateBookingUploadMime("text/plain", badExt),
      false,
      `Should reject text/plain with ${badExt}`
    );
    assert.equal(
      validateBookingUploadMime("image/png", badExt),
      false,
      `Should reject image/png with ${badExt}`
    );
  }

  // Paired MIME <-> Extension mismatches for concrete MIMEs
  assert.equal(validateBookingUploadMime("image/png", "payload.xml"), false);
  assert.equal(validateBookingUploadMime("image/png", "evil.exe"), false);
  assert.equal(validateBookingUploadMime("image/png", "fake.jpg"), false);
  assert.equal(validateBookingUploadMime("application/pdf", "notes.txt"), false);
  assert.equal(validateBookingUploadMime("image/png", "noext"), false);

  // Accepted safe booking document types
  const validCases: Array<[string, string | undefined]> = [
    ["application/pdf", "brief.pdf"],
    ["application/msword", "draft.doc"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "draft.docx"],
    ["text/plain", "notes.txt"],
    ["text/plain; charset=utf-8", "notes.txt"],
    ["text/markdown", "outline.md"],
    ["text/csv", "data.csv"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "sheet.xlsx"],
    ["image/png", "diagram.png"],
    ["image/jpeg", "photo.jpg"],
    ["image/webp", "mockup.webp"],
    ["application/zip", "assets.zip"],
    ["application/x-zip-compressed", "assets.zip"],
    ["application/octet-stream", "dataset.bin"],
    ["application/octet-stream", undefined],
  ];

  for (const [mime, name] of validCases) {
    assert.equal(
      validateBookingUploadMime(mime, name),
      true,
      `Should accept ${mime} (${name ?? "no filename"})`
    );
  }
});

test("validateMediaUploadMime enforces strict purpose-based allowlists (Review Focus #2)", () => {
  // USER_AVATAR & CREATOR_PORTFOLIO_IMAGE: ONLY jpeg/png/webp
  for (const purpose of [
    MediaAssetPurpose.USER_AVATAR,
    MediaAssetPurpose.CREATOR_PORTFOLIO_IMAGE,
  ]) {
    assert.equal(validateMediaUploadMime("image/jpeg", purpose), true);
    assert.equal(validateMediaUploadMime("image/png", purpose, "avatar.png"), true);
    assert.equal(validateMediaUploadMime("image/webp; charset=binary", purpose, "avatar.webp"), true);

    assert.equal(validateMediaUploadMime("image/svg+xml", purpose), false);
    assert.equal(validateMediaUploadMime("image/avif", purpose), false);
    assert.equal(validateMediaUploadMime("text/html", purpose), false);
    assert.equal(validateMediaUploadMime("application/javascript", purpose), false);
    assert.equal(validateMediaUploadMime("application/pdf", purpose), false);
    assert.equal(validateMediaUploadMime("text/plain", purpose), false);
    assert.equal(validateMediaUploadMime("image/png", purpose, "evil.svg"), false);
    assert.equal(validateMediaUploadMime("image/png", purpose, "evil.svg."), false);
    assert.equal(validateMediaUploadMime("image/png", purpose, "evil.html"), false);
    assert.equal(validateMediaUploadMime("image/png", purpose, "avatar.jpg"), false);
    assert.equal(validateMediaUploadMime("image/png", purpose, "avatar"), false);
  }

  // CREATOR_PORTFOLIO_DOCUMENT: images + pdf/txt/docx
  assert.equal(validateMediaUploadMime("application/pdf", MediaAssetPurpose.CREATOR_PORTFOLIO_DOCUMENT, "sample.pdf"), true);
  assert.equal(validateMediaUploadMime("text/plain", MediaAssetPurpose.CREATOR_PORTFOLIO_DOCUMENT, "sample.txt"), true);
  assert.equal(
    validateMediaUploadMime(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      MediaAssetPurpose.CREATOR_PORTFOLIO_DOCUMENT,
      "sample.docx"
    ),
    true
  );
  assert.equal(validateMediaUploadMime("image/jpeg", MediaAssetPurpose.CREATOR_PORTFOLIO_DOCUMENT), true);
  assert.equal(validateMediaUploadMime("text/plain", MediaAssetPurpose.CREATOR_PORTFOLIO_DOCUMENT, "fake.png"), false);
  assert.equal(validateMediaUploadMime("application/pdf", MediaAssetPurpose.CREATOR_PORTFOLIO_DOCUMENT, "fake.txt"), false);
  assert.equal(validateMediaUploadMime("image/svg+xml", MediaAssetPurpose.CREATOR_PORTFOLIO_DOCUMENT), false);
  assert.equal(validateMediaUploadMime("text/html", MediaAssetPurpose.CREATOR_PORTFOLIO_DOCUMENT), false);
  assert.equal(validateMediaUploadMime("application/javascript", MediaAssetPurpose.CREATOR_PORTFOLIO_DOCUMENT), false);
  assert.equal(validateMediaUploadMime("application/octet-stream", MediaAssetPurpose.CREATOR_PORTFOLIO_DOCUMENT), false);
  assert.equal(validateMediaUploadMime("application/pdf", MediaAssetPurpose.CREATOR_PORTFOLIO_DOCUMENT, "spoof.html"), false);

  // EDITORIAL_ASSET: jpeg/png/webp/avif
  assert.equal(validateMediaUploadMime("image/avif", MediaAssetPurpose.EDITORIAL_ASSET, "hero.avif"), true);
  assert.equal(validateMediaUploadMime("image/webp", MediaAssetPurpose.EDITORIAL_ASSET), true);
  assert.equal(validateMediaUploadMime("application/pdf", MediaAssetPurpose.EDITORIAL_ASSET), false);
  assert.equal(validateMediaUploadMime("image/svg+xml", MediaAssetPurpose.EDITORIAL_ASSET), false);

  // GENERAL: safe images + safe documents, no SVG/HTML/JS/executables
  assert.equal(validateMediaUploadMime("application/pdf", MediaAssetPurpose.GENERAL, "guide.pdf"), true);
  assert.equal(validateMediaUploadMime("image/png", MediaAssetPurpose.GENERAL, "cover.png"), true);
  assert.equal(validateMediaUploadMime("image/svg+xml", MediaAssetPurpose.GENERAL), false);
  assert.equal(validateMediaUploadMime("text/html", MediaAssetPurpose.GENERAL), false);
  assert.equal(validateMediaUploadMime("application/javascript", MediaAssetPurpose.GENERAL), false);
  assert.equal(validateMediaUploadMime("application/octet-stream", MediaAssetPurpose.GENERAL, "run.exe"), false);
});

test("signStorageAccess & verifyStorageAccess validate HMAC signatures safely", () => {
  const key = `${getR2KeyPrefix()}/bookings/b1/abcdef1234567890-notes.txt`;
  const futureExp = Date.now() + 60_000;
  const sig = signStorageAccess(key, futureExp);

  assert.equal(verifyStorageAccess(key, futureExp, sig), true);
  assert.equal(verifyStorageAccess(key, Date.now() - 1_000, signStorageAccess(key, Date.now() - 1_000)), false);
  assert.equal(verifyStorageAccess(`${key}.tampered`, futureExp, sig), false);
  assert.equal(verifyStorageAccess(key, futureExp, "short"), false);
  assert.equal(verifyStorageAccess(key, Number.NaN, sig), false);
});

test("buildPublicR2Url validates storageKey scope and builds public URL when configured", () => {
  const key = `${getR2KeyPrefix()}/media/avatars/user1/abcd1234-avatar.png`;
  const url = buildPublicR2Url(key);
  if (env.nextPublicR2PublicUrl || env.r2PublicUrl) {
    assert.ok(url !== null);
    assert.ok(url.startsWith("http"));
    assert.ok(url.endsWith(`/${key}`));
  } else {
    assert.equal(url, null);
  }

  assert.throws(() => buildPublicR2Url("../escape.png"), /INVALID_STORAGE_PATH/);
  assert.throws(() => buildPublicR2Url("other_app/media/avatar.png"), /INVALID_STORAGE_PATH/);
});

test("readPrivateFile honors explicit LOCAL legacy rows and NEVER silently falls back from R2 to local disk (Review Focus #5)", async () => {
  const uniqueFolder = `__test-legacy-${crypto.randomBytes(6).toString("hex")}`;
  const legacyKey = `${uniqueFolder}/legacy-note.txt`;
  const legacyPath = path.resolve(UPLOADS_ROOT, legacyKey);
  const legacyContent = Buffer.from("legacy local disk content", "utf8");

  const prefix = getR2KeyPrefix();
  const r2DecoyKey = `${prefix}/bookings/__test-decoy-${crypto.randomBytes(6).toString("hex")}/missing-r2-file.txt`;
  const r2DecoyLocalPath = path.resolve(UPLOADS_ROOT, r2DecoyKey);

  try {
    // 1. Explicit "LOCAL" reads from ./uploads/ even when hasR2Config() is true
    await fs.mkdir(path.dirname(legacyPath), { recursive: true });
    await fs.writeFile(legacyPath, legacyContent);

    const readBack = await readPrivateFile(legacyKey, "LOCAL");
    assert.deepEqual(readBack, legacyContent);

    await deleteStoredObject(legacyKey, "LOCAL");
    await assert.rejects(() => fs.stat(legacyPath));

    // 2. Explicit "R2" NEVER falls back to local disk even if a file exists at that local path
    await fs.mkdir(path.dirname(r2DecoyLocalPath), { recursive: true });
    await fs.writeFile(r2DecoyLocalPath, Buffer.from("decoy-should-never-be-read"));

    await assert.rejects(
      () => readPrivateFile(r2DecoyKey, "R2"),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        return true;
      },
      "R2 read for missing R2 key must reject instead of falling back to disk"
    );
  } finally {
    await fs.rm(path.resolve(UPLOADS_ROOT, uniqueFolder), { recursive: true, force: true });
    await fs.rm(path.resolve(UPLOADS_ROOT, path.dirname(r2DecoyKey)), { recursive: true, force: true });
    await fs.rmdir(path.resolve(UPLOADS_ROOT, prefix, "bookings")).catch(() => undefined);
    await fs.rmdir(path.resolve(UPLOADS_ROOT, prefix)).catch(() => undefined);
  }
});

test("readPublicLocalMedia reads _public local assets and rejects traversal", async () => {
  const prefix = getR2KeyPrefix();
  const testRunId = `test-local-pub-${crypto.randomBytes(6).toString("hex")}`;
  const key = `${prefix}/media/general/${testRunId}/abcd1234-sample.txt`;
  const targetPath = path.resolve(PUBLIC_LOCAL_ROOT, key);
  const payload = Buffer.from("offline public media bytes", "utf8");

  try {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, payload);

    const actual = await readPublicLocalMedia(key);
    assert.deepEqual(actual, payload);

    await assert.rejects(
      () => readPublicLocalMedia("../outside.txt"),
      /INVALID_STORAGE_PATH/
    );
  } finally {
    await fs.rm(path.resolve(PUBLIC_LOCAL_ROOT, path.dirname(key)), { recursive: true, force: true });
    await fs.rmdir(path.resolve(PUBLIC_LOCAL_ROOT, prefix, "media", "general")).catch(() => undefined);
    await fs.rmdir(path.resolve(PUBLIC_LOCAL_ROOT, prefix, "media")).catch(() => undefined);
    await fs.rmdir(path.resolve(PUBLIC_LOCAL_ROOT, prefix)).catch(() => undefined);
    await fs.rmdir(PUBLIC_LOCAL_ROOT).catch(() => undefined);
  }
});

test("writePublicMedia and createPresignedUploadUrl reject active/mismatched content before S3 or disk I/O", async () => {
  const prefix = getR2KeyPrefix();

  await assert.rejects(
    () =>
      writePublicMedia(
        `${prefix}/media/general/u1/abcd1234-x.html`,
        Buffer.from("<script>alert(1)</script>"),
        "text/html"
      ),
    /UNSUPPORTED_FILE_TYPE/
  );
  await assert.rejects(
    () =>
      writePublicMedia(
        `${prefix}/media/general/u1/abcd1234-x.svg`,
        Buffer.from("<svg/>"),
        "image/png"
      ),
    /UNSUPPORTED_FILE_TYPE/
  );
  await assert.rejects(
    () =>
      writePublicMedia(
        `${prefix}/media/general/u1/abcd1234-x.html.`,
        Buffer.from("hi"),
        "text/plain"
      ),
    /UNSUPPORTED_FILE_TYPE/
  );

  await assert.rejects(
    () =>
      createPresignedUploadUrl(
        `${prefix}/bookings/b1/0123456789abcdef-x.svg`,
        "image/svg+xml"
      ),
    /UNSUPPORTED_FILE_TYPE/
  );
  await assert.rejects(
    () =>
      createPresignedUploadUrl(
        `${prefix}/bookings/b1/0123456789abcdef-x.html`,
        "text/html"
      ),
    /UNSUPPORTED_FILE_TYPE/
  );
  await assert.rejects(
    () =>
      createPresignedUploadUrl(
        `${prefix}/bookings/b1/0123456789abcdef-x.xml`,
        "image/png"
      ),
    /UNSUPPORTED_FILE_TYPE/
  );
});

test("live R2 private & public roundtrip (write -> read/fetch -> presign -> delete)", async (t) => {
  if (!hasR2Config()) {
    t.skip("R2 credentials not configured in this environment");
    return;
  }

  const runId = crypto.randomBytes(6).toString("hex");
  const privateKey = createStorageKey(`test-booking-${runId}`, "contract-test.txt");
  const privatePayload = Buffer.from(`Tovolana R2 private test ${runId}`, "utf8");
  const presignKey = createStorageKey(`test-booking-${runId}`, "presign-target.txt");
  const presignPayload = Buffer.from(`Tovolana R2 presign PUT ${runId}`, "utf8");

  const mediaKey = createMediaStorageKey("avatars", `test-user-${runId}`, "pixel.png");
  // Minimal valid 1x1 transparent PNG
  const pngPayload = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64"
  );

  try {
    // 1. Private object lifecycle
    const privateStored = await writePrivateFile(privateKey, privatePayload, "text/plain");
    assert.equal(privateStored.storageProvider, "R2");
    assert.equal(privateStored.storageKey, privateKey);
    assert.equal(privateStored.bucket, env.r2BucketName);
    assert.ok(privateStored.etag && privateStored.etag.length > 0);
    assert.equal(privateStored.sizeBytes, privatePayload.byteLength);

    const fetchedPrivate = await readPrivateFile(privateKey, "R2");
    assert.deepEqual(fetchedPrivate, privatePayload);

    const presignedDownload = await createPresignedDownloadUrl(privateKey, 120);
    assert.ok(presignedDownload.startsWith("https://"));
    const dlRes = await fetch(presignedDownload);
    assert.equal(dlRes.status, 200);
    const dlBytes = Buffer.from(await dlRes.arrayBuffer());
    assert.deepEqual(dlBytes, privatePayload);

    const presignedUpload = await createPresignedUploadUrl(
      presignKey,
      "text/plain",
      120
    );
    assert.ok(presignedUpload.startsWith("https://"));
    assert.ok(presignedUpload.includes("X-Amz-Signature="));

    const putRes = await fetch(presignedUpload, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: presignPayload,
    });
    assert.equal(putRes.status, 200);
    const readPresigned = await readPrivateFile(presignKey, "R2");
    assert.deepEqual(readPresigned, presignPayload);

    await deleteStoredObject(presignKey, "R2");
    await deleteStoredObject(privateKey, "R2");
    await assert.rejects(() => readPrivateFile(privateKey, "R2"));

    // 2. Public media object lifecycle
    const mediaStored = await writePublicMedia(mediaKey, pngPayload, "image/png");
    assert.equal(mediaStored.storageProvider, "R2");
    assert.equal(mediaStored.storageKey, mediaKey);
    assert.equal(mediaStored.bucket, env.r2BucketName);
    assert.ok(mediaStored.etag && mediaStored.etag.length > 0);

    if (mediaStored.publicUrl) {
      const pubRes = await fetch(mediaStored.publicUrl);
      assert.equal(pubRes.status, 200);
      const pubBytes = Buffer.from(await pubRes.arrayBuffer());
      assert.deepEqual(pubBytes, pngPayload);
    }

    await deleteStoredObject(mediaKey, "R2");
    if (mediaStored.publicUrl) {
      const afterDeleteRes = await fetch(mediaStored.publicUrl);
      assert.notEqual(afterDeleteRes.status, 200);
    }
  } finally {
    await deleteStoredObject(privateKey, "R2").catch(() => undefined);
    await deleteStoredObject(presignKey, "R2").catch(() => undefined);
    await deleteStoredObject(mediaKey, "R2").catch(() => undefined);
  }
});
