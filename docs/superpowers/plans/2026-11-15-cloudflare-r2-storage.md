# Cloudflare R2 Object Storage & PostgreSQL Media Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Tovolana Writers off local disk storage (`uploads/`) to Cloudflare R2 under prefix `tovolana_writers/` inside the shared `gtss` bucket with full Neon PostgreSQL tracking (`BookingFile` + `MediaAsset`), end-to-end UI uploaders, and an idempotent R2 backfill script.

**Architecture:** All browser uploads (booking briefs, deliverables, revision/dispute evidence, user avatars, and creator portfolio attachments) route single-step through authenticated Next.js App Router API routes -> `@aws-sdk/client-s3` `PutObjectCommand` into Cloudflare R2 under `R2_KEY_PREFIX` (`tovolana_writers/`), storing authoritative ownership and metadata in Neon PostgreSQL. Private booking documents use high-entropy keys and stream solely via RBAC-gated `/api/files/[fileId]` (`GetObjectCommand`), while public user/portfolio media resolves via `NEXT_PUBLIC_R2_PUBLIC_URL`; an explicit `"LOCAL"` `storageProvider` fallback preserves offline CI and any pre-existing unmigrated rows.

**Tech Stack:** Next.js 16.4.6 (App Router, `next/image`), Prisma 7 (`@prisma/client`, `@prisma/adapter-pg`), Neon PostgreSQL, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, Zod 4, Node built-in `node:test` (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-11-15-cloudflare-r2-storage-design.md`

---

## Global Constraints

- Isolate every stored object in bucket `gtss` under `R2_KEY_PREFIX="tovolana_writers"` (`tovolana_writers/bookings/...` and `tovolana_writers/media/...`); never read, modify, or delete sibling `gtss` prefixes or `gtss` bucket CORS (`NoSuchCORSConfiguration` stays untouched).
- Enforce a `4 MB` (`4 * 1024 * 1024` bytes) maximum upload payload (`MAX_BROWSER_UPLOAD_BYTES`) across all browser uploaders and API routes to stay safely below Vercel Functions' ~4.5 MB body cap.
- Never return or render raw `R2_PUBLIC_URL` (`pub-...r2.dev`) links for private `BookingFile` records (`CUSTOMER_BRIEF`, `CREATOR_DELIVERABLE`, `REVISION_ATTACHMENT`, `DISPUTE_EVIDENCE`).
- Never silently fall back to local disk when `storageProvider === "R2"` or `hasR2Config()` is true and an R2 request fails; use local `./uploads` ONLY when `storageProvider === "LOCAL"` or `!hasR2Config()` (CI offline compatibility).
- Never commit live credentials (`.env` only; `.env.example` stays sanitized with placeholders).

## Review Focus

1. **Cross-tenant bucket key traversal / prefix escape:** Untrusted filenames or keys containing `..`, slashes, or missing `tovolana_writers/` could touch sibling `gtss` folders -> Task 3 pins unit tests asserting `createStorageKey`, `createMediaStorageKey`, and `assertScopedStorageKey` reject `..`/empty keys and guarantee every generated/read key stays under `${r2KeyPrefix}/`.
2. **Stored XSS via active content (`image/svg+xml`, `text/html`, `application/javascript`):** Uploading SVG/HTML served from CDN or `/api/files/[fileId]` would execute scripts -> Task 3, Task 4, and Task 5 pin tests asserting `400 UNSUPPORTED_FILE_TYPE` on SVG/HTML uploads and `X-Content-Type-Options: nosniff` on download responses.
3. **Post-delivery / dispute evidence tampering via `DELETE /api/files/[fileId]`:** Non-admin uploaders deleting `CREATOR_DELIVERABLE` after `DELIVERED` or any booking file during `DISPUTED`/`COMPLETED`/`CANCELLED`/`REFUNDED` breaks escrow auditability -> Task 4 pins integration tests asserting `409 FILE_LOCKED_BY_BOOKING_STATUS` for non-admin users while allowing pre-delivery customer removal (<= 24h) and `ADMIN` override.
4. **Oversized base64 & multipart `> 4 MB` payloads:** Decoded base64 strings (~33% overhead) or multipart uploads exceeding `4 * 1024 * 1024` bytes must fail consistently before calling R2 -> Task 4 and Task 5 pin `400 FILE_TOO_LARGE` tests on decoded base64 buffers exceeding 4 MB.
5. **Next.js `<Image>` hostname errors & unmigrated `"LOCAL"` DB rows when R2 is enabled:** Rendering Google OAuth avatars (`lh3.googleusercontent.com`), `NEXT_PUBLIC_R2_PUBLIC_URL`, or local offline fallback `/api/media/[id]/raw` in `<Image>`, or reading an unmigrated `"LOCAL"` `BookingFile` row when `hasR2Config()` is true -> Task 1 verifies `next.config.ts` `remotePatterns`, Task 3 tests reading `storageProvider = "LOCAL"` from disk while failing strictly on missing `"R2"` keys, and Task 6 marks `/api/media/` URLs `unoptimized` in `CreatorAvatar`.

---

## File Structure Map

| File | Responsibility |
|---|---|
| `.env`, `.env.example`, `lib/env.ts`, `next.config.ts`, `package.json` | R2 credentials, `MAX_BROWSER_UPLOAD_BYTES`, `hasR2Config()`, AWS S3 SDK deps, `next/image` remote domains |
| `prisma/schema.prisma`, `prisma/migrations/*_add_r2_media_registry/` | `MediaAsset` + `MediaAssetPurpose`, backfill-safe `BookingFile.storageProvider`/`bucket`/`etag`/`revisionId`/`disputeId` |
| `lib/storage.ts` | Cloudflare R2 `S3Client` singleton, prefix-locked key builders, MIME/size validators, `LOCAL` vs `R2` I/O, presigned helpers |
| `app/api/bookings/[ref]/files/presign/route.ts` | Private booking file upload (multipart/JSON/base64, <= 4 MB, MIME check, R2 + `BookingFile`) |
| `app/api/files/[fileId]/route.ts` | RBAC + HMAC download (`X-Content-Type-Options: nosniff`) & lifecycle-locked `DELETE` |
| `app/api/media/upload/route.ts`, `app/api/media/[id]/route.ts`, `app/api/media/[id]/raw/route.ts` | Authenticated media upload/delete (`USER_AVATAR`, `CREATOR_PORTFOLIO_*`, `EDITORIAL_ASSET`), atomic `User.avatarUrl` sync, offline `LOCAL` fallback stream |
| `app/api/bookings/[ref]/revision/route.ts`, `dispute/route.ts`, `admin/overview/route.ts`, `creators-hub/profile/route.ts`, `tasks/route.ts`, `tasks/[slug]/route.ts`, `creators/[username]/route.ts`, `bookings/[ref]/route.ts`, `settings/route.ts` | Serialize `avatarUrl`, `portfolioSamples` attachments, `revisionId`/`disputeId` file linking, and `openDisputes[].booking.files` |
| `components/ui/EditorialVisuals.tsx`, `components/Navbar.tsx`, `components/CustomerShell.tsx`, `components/CreatorShell.tsx`, `components/TaskCard.tsx`, `app/page.tsx`, `app/explore/page.tsx`, `app/tasks/[slug]/page.tsx`, `app/creators/[username]/page.tsx`, `app/book/[taskId]/page.tsx`, `app/dashboard/page.tsx`, `app/dashboard/settings/page.tsx`, `app/creators-hub/profile/page.tsx`, `app/dashboard/bookings/[bookingRef]/page.tsx`, `app/dashboard/bookings/[bookingRef]/revision/page.tsx`, `app/dashboard/bookings/[bookingRef]/dispute/page.tsx`, `app/creators-hub/bookings/[ref]/page.tsx`, `app/admin/bookings/page.tsx` | Render `avatarUrl`, add avatar/portfolio/evidence uploaders, conditional delete controls, 4 MB hints, fix `CREATOR_DELIVERABLE` bug, render Admin dispute evidence |
| `scripts/sync-r2.ts` | Idempotent CLI migration of local `BookingFile`s + `public/images/photos/` sync + leftover test folder cleanup |
| `tests/storage.test.ts`, `tests/backend.test.ts` | Unit + integration test suites for R2 storage, RBAC/lifecycle/XSS guarantees, media APIs |

---

### Task 1: Dependencies, R2 Environment Config, and `next.config.ts`

**Files:**
- Modify: `package.json`, `.env`, `.env.example`
- Modify: `lib/env.ts`
- Modify: `next.config.ts`
- Test: `tests/storage-env.test.ts`

**Interfaces:**
- Consumes: `process.env.R2_*`, `NEXT_PUBLIC_R2_PUBLIC_URL`, `STORAGE_SIGNING_SECRET`
- Produces:
  - `env.r2AccountId`, `env.r2AccessKeyId`, `env.r2SecretAccessKey`, `env.r2BucketName`, `env.r2PublicUrl`, `env.nextPublicR2PublicUrl`, `env.r2Endpoint`, `env.r2KeyPrefix` (all `string`, `r2KeyPrefix` defaults to `"tovolana_writers"`)
  - `hasR2Config(): boolean`
  - `MAX_BROWSER_UPLOAD_BYTES = 4 * 1024 * 1024` (re-exported or defined in `lib/storage.ts` / `lib/env.ts`)

- [ ] **Step 1: Write failing unit test for R2 env config & helpers**

Create `tests/storage-env.test.ts`:
```ts
import test from "node:test";
import assert from "node:assert/strict";
import { env, hasR2Config } from "@/lib/env";
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/storage-env.test.ts`
Expected: FAIL (`env.r2KeyPrefix` is undefined / `hasR2Config` is not exported).

- [ ] **Step 3: Install AWS S3 SDK packages & configure `.env`, `.env.example`, `lib/env.ts`, and `next.config.ts`**

1. Run: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
2. Update `.env` File Storage section with the provided Cloudflare R2 credentials (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME="gtss"`, `R2_PUBLIC_URL`, `NEXT_PUBLIC_R2_PUBLIC_URL`, `R2_ENDPOINT`) plus `R2_KEY_PREFIX="tovolana_writers"` while retaining `STORAGE_SIGNING_SECRET`.
3. Update `.env.example` lines 82-89 to document `R2_*`, `NEXT_PUBLIC_R2_PUBLIC_URL`, `R2_KEY_PREFIX="tovolana_writers"` with empty/placeholder values and deprecate `STORAGE_BUCKET_URL`.
4. Update `lib/env.ts` to add `r2AccountId`, `r2AccessKeyId`, `r2SecretAccessKey`, `r2BucketName`, `r2PublicUrl`, `nextPublicR2PublicUrl`, `r2Endpoint`, `r2KeyPrefix` (`process.env.R2_KEY_PREFIX || "tovolana_writers"`), and `hasR2Config(): boolean` checking account/endpoint + accessKeyId + secretAccessKey + bucketName (and rejecting placeholder strings).
5. Update `next.config.ts` `images.remotePatterns` to include `images.unsplash.com`, `lh3.googleusercontent.com`, `pub-cc07856d657b4a7197710051042b3eda.r2.dev`, and any valid hostname parsed dynamically from `process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/storage-env.test.ts`
Expected: PASS

- [ ] **Step 5: Verify no TypeScript error on modified files**

Run: `npx tsc --noEmit`

---

### Task 2: Prisma Schema (`BookingFile` Metadata & `MediaAsset` Model) + Backfill-Safe Migration

**Files:**
- Modify: `prisma/schema.prisma` (`User`, `BookingFile`, new `MediaAssetPurpose` enum, new `MediaAsset` model)
- Create: `prisma/migrations/<timestamp>_add_r2_media_registry/migration.sql`
- Test: `tests/storage-env.test.ts` (or inspect generated Prisma client types)

**Interfaces:**
- Consumes: PostgreSQL via `DATABASE_URL_UNPOOLED` (`prisma.config.ts`)
- Produces:
  - `BookingFile` fields: `storageProvider: string` (`@default("R2")`), `bucket: string | null`, `etag: string | null`, `revisionId: string | null`, `disputeId: string | null`
  - `MediaAssetPurpose` enum: `"USER_AVATAR" | "CREATOR_PORTFOLIO_IMAGE" | "CREATOR_PORTFOLIO_DOCUMENT" | "EDITORIAL_ASSET" | "GENERAL"`
  - `MediaAsset` model: `{ id, ownerId, purpose, fileName, mimeType, sizeBytes, storageProvider, bucket, storageKey, publicUrl, etag, createdAt, updatedAt }`

- [ ] **Step 1: Add `BookingFile` extensions, `MediaAssetPurpose`, and `MediaAsset` to `prisma/schema.prisma`**

Add `mediaAssets MediaAsset[]` to `User`.
Extend `BookingFile`:
```prisma
  storageProvider String       @default("R2")
  bucket          String?
  etag            String?
  revisionId      String?
  disputeId       String?
```
Add `MediaAssetPurpose` and `MediaAsset` model:
```prisma
enum MediaAssetPurpose {
  USER_AVATAR
  CREATOR_PORTFOLIO_IMAGE
  CREATOR_PORTFOLIO_DOCUMENT
  EDITORIAL_ASSET
  GENERAL
}

model MediaAsset {
  id              String            @id @default(cuid())
  ownerId         String?
  purpose         MediaAssetPurpose @default(GENERAL)
  fileName        String
  mimeType        String
  sizeBytes       Int
  storageProvider String            @default("R2")
  bucket          String?
  storageKey      String            @unique
  publicUrl       String?
  etag            String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  owner User? @relation(fields: [ownerId], references: [id], onDelete: SetNull)

  @@index([ownerId, purpose])
}
```

- [ ] **Step 2: Create migration SQL (`--create-only`) and make `storageProvider` backfill-safe**

Run: `npx prisma migrate dev --name add_r2_media_registry --create-only`
Inspect the generated `migration.sql` and ensure `"BookingFile"` adds `"storageProvider" TEXT NOT NULL DEFAULT 'LOCAL'` first (so any existing unmigrated rows across any environment remain accurately tagged `'LOCAL'`), followed by `ALTER TABLE "BookingFile" ALTER COLUMN "storageProvider" SET DEFAULT 'R2';` so new rows default to `'R2'`.

- [ ] **Step 3: Apply migration to Neon & generate Prisma Client**

Run: `npx prisma migrate deploy && npx prisma generate`
Expected: Migration applies cleanly to `ep-lively-fog-bd8wwciq.c-8.us-east-2.aws.neon.tech` and existing `brief-notes.txt` `BookingFile` row shows `storageProvider = 'LOCAL'`. Verify with:
`PATH="/home/elvin/.nvm/versions/node/v24.3.0/bin:$PATH" neon psql --role-name neondb_owner -- -c 'SELECT id, "storageProvider", bucket FROM "BookingFile";' -c '\d "MediaAsset"'`

---

### Task 3: Cloudflare R2 Storage Driver (`lib/storage.ts`) & Prefix/MIME/Fallback Tests

**Files:**
- Modify: `lib/storage.ts`
- Create: `tests/storage.test.ts`

**Interfaces:**
- Consumes: `env`, `hasR2Config` (`lib/env.ts`), `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
- Produces in `lib/storage.ts`:
  - `MAX_BROWSER_UPLOAD_BYTES = 4 * 1024 * 1024`
  - `sanitizeFileName(name: string): string`
  - `getR2KeyPrefix(): string` (sanitized, never empty, default `"tovolana_writers"`)
  - `assertScopedStorageKey(storageKey: string): string` (throws `INVALID_STORAGE_PATH` if `..`, leading `/`, empty, or not under `${getR2KeyPrefix()}/` when writing new keys, plus allows safe reading of legacy pre-migration keys starting with a bookingId/cuid when `storageProvider === "LOCAL"`)
  - `createStorageKey(bookingId: string, fileName: string): string` -> `${prefix}/bookings/${safeBookingId}/${rand16}-${safeName}`
  - `createMediaStorageKey(folder: "avatars" | "portfolios" | "editorial" | "general", ownerSegment: string, fileName: string): string` -> `${prefix}/media/${folder}/${safeOwner}/${rand8}-${safeName}`
  - `buildPublicR2Url(storageKey: string): string | null`
  - `validateBookingUploadMime(mimeType: string, fileName?: string): boolean` (blocks `text/html`, `image/svg+xml`, `application/javascript`, executables; allows PDF/DOC/DOCX/TXT/MD/CSV/XLSX/PNG/JPEG/WEBP/ZIP/octet-stream)
  - `validateMediaUploadMime(mimeType: string, purpose: MediaAssetPurpose): boolean` (strict allowlist: `jpeg`/`png`/`webp` for `USER_AVATAR` and `CREATOR_PORTFOLIO_IMAGE`; adds `pdf`/`txt`/`docx` for `CREATOR_PORTFOLIO_DOCUMENT`)
  - `writePrivateFile(storageKey: string, buffer: Buffer, contentType?: string): Promise<StoredObjectResult>`
  - `readPrivateFile(storageKey: string, storageProvider?: string | null): Promise<Buffer>`
  - `writePublicMedia(storageKey: string, buffer: Buffer, contentType: string): Promise<StoredObjectResult & { publicUrl: string | null }>`
  - `readPublicLocalMedia(storageKey: string): Promise<Buffer>` (for CI offline `_public` fallback)
  - `deleteStoredObject(storageKey: string, storageProvider?: string | null): Promise<void>`
  - `createPresignedUploadUrl(storageKey: string, contentType: string, expiresInSec?: number): Promise<string>`
  - `createPresignedDownloadUrl(storageKey: string, expiresInSec?: number): Promise<string>`
  - Existing HMAC helpers `signStorageAccess` & `verifyStorageAccess` preserved cleanly.

- [ ] **Step 1: Write failing unit tests in `tests/storage.test.ts` (including Review Focus #1, #2, #5)**

Create `tests/storage.test.ts` testing:
1. `createStorageKey` and `createMediaStorageKey` prefix isolation under `tovolana_writers/`, path traversal sanitization (`../../etc/passwd` never escapes), and `assertScopedStorageKey` rejection of `../foo` or wrong bucket folder prefixes on R2 keys (`Review Focus #1`).
2. `validateBookingUploadMime` & `validateMediaUploadMime` reject `image/svg+xml`, `text/html`, `application/javascript` and accept `application/pdf`, `image/png`, `image/webp`, `image/jpeg`, `text/plain` (`Review Focus #2`).
3. `readPrivateFile(legacyKey, "LOCAL")` reads from local `./uploads/` even when R2 env config is present, whereas `readPrivateFile("tovolana_writers/bookings/missing-r2-file.txt", "R2")` rejects rather than silently falling back to disk (`Review Focus #5`).
4. Live R2 roundtrip (`writePrivateFile` -> `readPrivateFile` -> `deleteStoredObject` + `writePublicMedia` -> HTTP `GET` on `publicUrl` -> `deleteStoredObject`) skipped cleanly only if `!hasR2Config()`, and mandatory locally!

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/storage.test.ts`
Expected: FAIL (`assertScopedStorageKey` / `createMediaStorageKey` / `validateMediaUploadMime` not defined).

- [ ] **Step 3: Implement R2 storage driver in `lib/storage.ts`**

Implement singleton `S3Client` with `region: "auto"`, `endpoint: env.r2Endpoint || \`https://${env.r2AccountId}.r2.cloudflarestorage.com\``, `requestChecksumCalculation: "WHEN_REQUIRED"`, `responseChecksumValidation: "WHEN_REQUIRED"`. Implement all exported functions with clear separation between `"R2"` (strict R2 S3 errors propagate) and `"LOCAL"` (`!hasR2Config()` or explicit `"LOCAL"` legacy rows).

- [ ] **Step 4: Run `tests/storage.test.ts` to verify all unit + live R2 tests pass**

Run: `npx tsx --test tests/storage.test.ts`
Expected: PASS (0 failures, live R2 put/read/public fetch/delete verified and cleaned up).

---

### Task 4: Private Booking Document Routes, Revisions/Disputes File Linking & Admin Tribunal

**Files:**
- Modify: `app/api/bookings/[ref]/files/presign/route.ts`
- Modify: `app/api/files/[fileId]/route.ts`
- Modify: `app/api/bookings/[ref]/revision/route.ts`
- Modify: `app/api/bookings/[ref]/dispute/route.ts`
- Modify: `app/api/admin/overview/route.ts`
- Test: `tests/backend.test.ts`

**Interfaces:**
- Consumes: `lib/storage.ts` (`MAX_BROWSER_UPLOAD_BYTES`, `createStorageKey`, `writePrivateFile`, `readPrivateFile`, `deleteStoredObject`, `validateBookingUploadMime`, `signStorageAccess`, `verifyStorageAccess`)
- Produces:
  - `POST /api/bookings/[ref]/files/presign`: returns `{ file, downloadUrl }` (HTTP `201`), sets `storageProvider`, `bucket`, `etag`, optional `revisionId`, `disputeId`; enforces `400 FILE_TOO_LARGE` (> 4 MB) & `400 UNSUPPORTED_FILE_TYPE`
  - `GET /api/files/[fileId]`: returns bytes from R2 or `"LOCAL"` disk with `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`
  - `DELETE /api/files/[fileId]`: returns `200 { deletedId }` or `409 FILE_LOCKED_BY_BOOKING_STATUS` / `403 FORBIDDEN`
  - `GET /api/admin/overview`: `data.openDisputes[].booking.files` included

- [ ] **Step 1: Add failing assertions to `tests/backend.test.ts` (Review Focus #2, #3, #4)**

In `tests/backend.test.ts` Test 5 (or new Test 6 cleaning up created objects):
1. Assert uploaded `uploadData.file.storageKey` starts with `${env.r2KeyPrefix}/bookings/` and download response includes `X-Content-Type-Options: nosniff`.
2. Assert `POST /api/bookings/${bookingRef}/files/presign` rejects SVG (`image/svg+xml`) and `> 4 MB` `contentBase64` payloads with `400`.
3. Assert customer can upload & delete a temporary `CUSTOMER_BRIEF` file prior to completion, while after creator delivers (`DELIVERED`) or opens dispute (`DISPUTED`), non-admin `DELETE /api/files/${deliverableId}` fails with `409`, whereas `ADMIN` deletion succeeds cleanly.

- [ ] **Step 2: Run `npm test` to confirm new assertions fail**

Run: `npm test`
Expected: FAIL (`DELETE` route missing / SVG accepted / no `tovolana_writers/` prefix check).

- [ ] **Step 3: Implement backend booking file routes & serialization updates**

1. Update `app/api/bookings/[ref]/files/presign/route.ts`:
   - Accept optional `revisionId` / `disputeId` (verify both belong to `booking.id` if provided).
   - Enforce `MAX_BROWSER_UPLOAD_BYTES` (`4 MB`) on BOTH `File.size` and decoded JSON `contentBase64`/`contentText` buffer length (`400 FILE_TOO_LARGE`).
   - Enforce `validateBookingUploadMime(mimeType, fileName)` (`400 UNSUPPORTED_FILE_TYPE`).
   - Call `writePrivateFile(storageKey, buffer, mimeType)` -> persist `storageProvider`, `bucket`, `etag`, `storageKey`, `revisionId`, `disputeId` on `db.bookingFile.create`.
2. Update `app/api/files/[fileId]/route.ts`:
   - In `GET`: pass `fileRecord.storageProvider` to `readPrivateFile`, add `X-Content-Type-Options: nosniff`, sanitize filename in `Content-Disposition`.
   - Add `DELETE`: `requireAuth`, check `ADMIN` vs original `uploaderId` within 24h AND pre-lock booking state (`COMPLETED`, `DISPUTED`, `CANCELLED`, `REFUNDED` block all non-admin deletion; `CREATOR_DELIVERABLE` deletion also blocked when `DELIVERED`), return `409 FILE_LOCKED_BY_BOOKING_STATUS`, delete object via `deleteStoredObject` then delete DB row.
3. Update `app/api/bookings/[ref]/revision/route.ts` and `dispute/route.ts`:
   - Accept optional `attachmentFileIds: z.array(z.string()).max(5).optional()` and attach `revisionId` / `disputeId` inside the transaction when linking uploaded booking files.
4. Update `app/api/admin/overview/route.ts`:
   - Include `files: { orderBy: { createdAt: "desc" }, include: { uploader: { select: { id: true, name: true } } } }` inside `openDisputes[].booking`.

- [ ] **Step 4: Run `npm test` and verify all tests pass**

Run: `npm test`
Expected: PASS (0 failures).

---

### Task 5: Public Media Upload/Delete APIs (`/api/media/*`) & Profile/Listing Avatar Serialization

**Files:**
- Create: `app/api/media/upload/route.ts`
- Create: `app/api/media/[id]/route.ts`
- Create: `app/api/media/[id]/raw/route.ts`
- Modify: `app/api/creators-hub/profile/route.ts`
- Modify: `app/api/settings/route.ts`
- Modify: `app/api/tasks/route.ts`
- Modify: `app/api/tasks/[slug]/route.ts`
- Modify: `app/api/creators/[username]/route.ts`
- Modify: `app/api/bookings/[ref]/route.ts`
- Test: `tests/backend.test.ts`

**Interfaces:**
- Consumes: `lib/storage.ts` (`MAX_BROWSER_UPLOAD_BYTES`, `createMediaStorageKey`, `writePublicMedia`, `readPublicLocalMedia`, `deleteStoredObject`, `validateMediaUploadMime`), `MediaAsset`
- Produces:
  - `POST /api/media/upload` -> `201 { asset, publicUrl }`
  - `DELETE /api/media/[id]` -> `200 { deletedId }`
  - `GET /api/media/[id]/raw` -> streams offline `LOCAL` public media asset in CI without R2
  - `creator.user.avatarUrl` / `user.avatarUrl` included on `/api/tasks`, `/api/tasks/[slug]`, `/api/creators/[username]`, `/api/bookings/[ref]`, `/api/settings`
  - `portfolioSamples` accepts optional `{ attachmentUrl?, attachmentName?, attachmentAssetId?, mimeType? }`

- [ ] **Step 1: Add failing integration test in `tests/backend.test.ts` for `/api/media/upload` & `/api/media/[id]`**

Add test verifying:
1. Authenticated `POST /api/media/upload` (`USER_AVATAR` valid PNG base64) returns `201`, stores `MediaAsset` (`storageKey` under `${env.r2KeyPrefix}/media/avatars/`), updates `User.avatarUrl` on DB + `/api/settings`.
2. Re-uploading a new avatar replaces the previous `USER_AVATAR` asset cleanly.
3. `image/svg+xml` avatar upload fails with `400`, `> 4 MB` base64 upload fails with `400`, non-owner `DELETE /api/media/[id]` returns `403`, and owner `DELETE /api/media/[id]` removes the object & clears `User.avatarUrl` back to `null`.
4. `CREATOR_PORTFOLIO_DOCUMENT` PDF upload succeeds and saves via `PATCH /api/creators-hub/profile`.

- [ ] **Step 2: Run `npm test` to confirm new test fails**

Run: `npm test`
Expected: FAIL (module `@/app/api/media/upload/route` does not exist).

- [ ] **Step 3: Implement `/api/media/*` routes & API avatar/portfolio serialization**

1. Implement `app/api/media/upload/route.ts`:
   - `requireAuth(request)`, parse `multipart/form-data` (`file`, `purpose`) or JSON (`fileName`, `mimeType`, `purpose`, `contentBase64`).
   - Only `ADMIN` may upload `EDITORIAL_ASSET`; any authenticated user may upload `USER_AVATAR` / `GENERAL`; creators (or `ADMIN`) may upload `CREATOR_PORTFOLIO_IMAGE` / `CREATOR_PORTFOLIO_DOCUMENT`.
   - Enforce `MAX_BROWSER_UPLOAD_BYTES` and `validateMediaUploadMime(mimeType, purpose)`.
   - Upload via `writePublicMedia(storageKey, buffer, mimeType)` to R2 (or local `_public` when `!hasR2Config()`, using fallback URL `/api/media/${assetId}/raw` if `publicUrl` is null).
   - For `USER_AVATAR`, wrap `MediaAsset` create + `db.user.update({ data: { avatarUrl } })` and delete prior `USER_AVATAR` assets for that user from R2 & DB.
2. Implement `app/api/media/[id]/route.ts` (`DELETE`) and `app/api/media/[id]/raw/route.ts` (`GET` for `LOCAL` CI mode / redirect when `publicUrl` exists).
3. Update `app/api/creators-hub/profile/route.ts`, `/api/settings`, `/api/tasks`, `/api/tasks/[slug]`, `/api/creators/[username]`, `/api/bookings/[ref]` to select/include `avatarUrl` and optional portfolio attachment fields.

- [ ] **Step 4: Run `npm test` to verify all backend tests pass**

Run: `npm test`
Expected: PASS (0 failures).

---

### Task 6: Frontend UI Integration (Avatars, Settings, Portfolio Attachments, Revision/Dispute Evidence, Admin Tribunal)

**Files:**
- Modify: `components/ui/EditorialVisuals.tsx`, `components/Navbar.tsx`, `components/CustomerShell.tsx`, `components/CreatorShell.tsx`, `components/TaskCard.tsx`
- Modify: `app/page.tsx`, `app/explore/page.tsx`, `app/tasks/[slug]/page.tsx`, `app/creators/[username]/page.tsx`, `app/book/[taskId]/page.tsx`, `app/dashboard/page.tsx`
- Modify: `app/dashboard/settings/page.tsx`, `app/creators-hub/profile/page.tsx`
- Modify: `app/dashboard/bookings/[bookingRef]/page.tsx`, `app/dashboard/bookings/[bookingRef]/revision/page.tsx`, `app/dashboard/bookings/[bookingRef]/dispute/page.tsx`
- Modify: `app/creators-hub/bookings/[ref]/page.tsx`, `app/admin/bookings/page.tsx`

**Interfaces:**
- Consumes: `/api/media/upload`, `/api/media/[id]`, `/api/bookings/[ref]/files/presign`, `/api/files/[fileId]`
- Produces:
  - `CreatorAvatar({ name, username, avatarUrl, available, size })` (`unoptimized` when `avatarUrl?.startsWith("/api/")`)
  - Working avatar uploader in Settings & Creator Profile
  - Portfolio attachment upload + public preview badge on `/creators/[username]`
  - Revision & Dispute evidence uploaders + Admin Dispute Tribunal download links
  - Clean `CREATOR_DELIVERABLE` category fix & lifecycle-aware delete controls on booking file vaults

- [ ] **Step 1: Update `CreatorAvatar` & pass `avatarUrl` across SSR pages, cards, and shells**

Update `components/ui/EditorialVisuals.tsx` (`CreatorAvatar` prop `avatarUrl?: string | null`, `unoptimized={Boolean(avatarUrl?.startsWith("/api/"))}`), `components/CustomerShell.tsx`, `components/CreatorShell.tsx`, `components/Navbar.tsx`, `components/TaskCard.tsx`, and queries in `app/page.tsx`, `app/explore/page.tsx`, `app/tasks/[slug]/page.tsx`, `app/creators/[username]/page.tsx` to select `user: { select: { avatarUrl: true } }` and forward it to `CreatorAvatar`.

- [ ] **Step 2: Wire avatar & portfolio attachment upload UIs**

1. `app/dashboard/settings/page.tsx`: add client-side 4 MB + JPG/PNG/WEBP validation, `POST /api/media/upload` (`purpose: "USER_AVATAR"`), remove button, and `await refresh()` to update `AuthContext` immediately.
2. `app/creators-hub/profile/page.tsx` & `app/creators/[username]/page.tsx`: add creator avatar upload + optional attachment uploader (`CREATOR_PORTFOLIO_IMAGE` / `CREATOR_PORTFOLIO_DOCUMENT`) on new portfolio excerpts, saving `{ attachmentUrl, attachmentName, attachmentAssetId, mimeType }` cleanly in `portfolioSamples` and displaying preview/download chips publicly.

- [ ] **Step 3: Wire booking file improvements, revision/dispute evidence uploaders & Admin Tribunal file list**

1. `app/creators-hub/bookings/[ref]/page.tsx`: fix `"REVISION_DELIVERABLE"` -> `"CREATOR_DELIVERABLE"` and add `MAX_BROWSER_UPLOAD_BYTES` client guard (`<= 4 MB`) + delete button when `booking.status` is `IN_PROGRESS` / `REVISION_REQUESTED`.
2. `app/dashboard/bookings/[bookingRef]/page.tsx`: add 4 MB hint/validation and uploader delete button before booking completion/dispute.
3. `app/dashboard/bookings/[bookingRef]/revision/page.tsx` & `dispute/page.tsx`: add optional `File` attachment input (`<= 4 MB`), upload to `/api/bookings/${bookingRef}/files/presign` (`REVISION_ATTACHMENT` / `DISPUTE_EVIDENCE`), pass `attachmentFileIds` on submit.
4. `app/admin/bookings/page.tsx`: render `d.booking.files` links (`/api/files/${f.id}`) inside each open dispute card in Escrow Dispute Tribunal.

- [ ] **Step 4: Run Next.js typegen, TypeScript check, and ESLint**

Run: `npx next typegen && npx tsc --noEmit && npm run lint`
Expected: EXIT 0 with zero TypeScript or lint errors.

---

### Task 7: Idempotent R2 Migration/Sync Script, Data Migration & End-to-End Verification

**Files:**
- Create: `scripts/sync-r2.ts`
- Modify: `package.json` (`"storage:sync-r2": "tsx scripts/sync-r2.ts"`)

**Interfaces:**
- Consumes: `lib/db.ts`, `lib/storage.ts`, `./uploads/`, `./public/images/photos/`
- Produces: Migrates `storageProvider = "LOCAL"` `BookingFile` rows into R2 (`tovolana_writers/bookings/...`), optionally mirrors `public/images/photos/` into `tovolana_writers/media/editorial/` + `MediaAsset` rows (`--with-editorial`), and supports `--prune-unlinked` to clean stale unreferenced `./uploads/*` test dirs.

- [ ] **Step 1: Write `scripts/sync-r2.ts` and add `"storage:sync-r2"` script to `package.json`**

Ensure `scripts/sync-r2.ts` refuses to run unless `hasR2Config()` is true, reads each `storageProvider === "LOCAL"` `BookingFile` from `./uploads/`, uploads to `${r2KeyPrefix}/bookings/...`, updates DB row (`storageProvider = "R2"`, `bucket`, `storageKey`, `etag`), syncs `public/images/photos/*` to `${r2KeyPrefix}/media/editorial/<filename>` (`upsert` by `storageKey` as `EDITORIAL_ASSET`) when `--with-editorial` is passed, and optionally removes empty/unlinked `./uploads/*` directories when `--prune-unlinked` is passed.

- [ ] **Step 2: Run migration script against Neon & R2 (`gtss/tovolana_writers/`)**

Run: `npm run storage:sync-r2 -- --with-editorial --prune-unlinked`
Verify via `neon psql` that all `BookingFile` rows show `storageProvider = 'R2'` and `MediaAsset` holds the synced editorial records (`tovolana_writers/media/editorial/...`).
Verify via R2 `ListObjectsV2` (prefix `tovolana_writers/`) that objects exist ONLY under `tovolana_writers/` and sibling `gtss` prefixes remain untouched.

- [ ] **Step 3: Full verification suite & live Next.js production server E2E check**

Run:
```bash
npx next typegen && npx tsc --noEmit && npm run lint && npm test && npm run build
```
Then start `npm run start` and run live HTTP end-to-end checks verifying:
1. Authenticated booking file upload (`POST /api/bookings/.../files/presign`) -> persisted in Neon (`storageProvider = "R2"`) + R2 (`gtss/tovolana_writers/bookings/...`) -> authorized `GET /api/files/[fileId]` returns exact bytes -> IDOR unauthorized user gets `403`.
2. Authenticated avatar upload (`POST /api/media/upload` `USER_AVATAR`) -> updates `User.avatarUrl` to `NEXT_PUBLIC_R2_PUBLIC_URL/tovolana_writers/media/avatars/...` -> HTTP `GET` on `publicUrl` returns `200` image -> `DELETE /api/media/[id]` cleans R2 & clears `User.avatarUrl`.
3. Clean up E2E test records and stop temporary `next start` process cleanly.

---

## Self-Review Results

- **Spec coverage checked:** Env vars (`R2_*`, `R2_KEY_PREFIX="tovolana_writers"`), `next.config.ts` image domains, backfill-safe `BookingFile.storageProvider` + `MediaAsset` migration, R2 S3 SDK + local CI fallback, 4 MB cap, MIME/XSS hardening, lifecycle-locked `DELETE /api/files/[fileId]`, `/api/media/*` avatar & portfolio upload/delete, `CreatorAvatar` + all UI uploaders, `CREATOR_DELIVERABLE` category fix, Admin Dispute Tribunal evidence display, and `scripts/sync-r2.ts` migration + cleanup are all mapped cleanly across Tasks 1–7.
- **Type & signature consistency verified:** `hasR2Config()`, `MAX_BROWSER_UPLOAD_BYTES`, `createStorageKey`, `createMediaStorageKey`, `validateBookingUploadMime`, `validateMediaUploadMime`, `writePrivateFile`, `readPrivateFile`, `writePublicMedia`, `deleteStoredObject`, `MediaAssetPurpose`, and `CreatorAvatar` `avatarUrl` match consistently across all tasks.
- **Proportion & clarity verified:** No code duplication; every task ends with runnable test/verification commands.
