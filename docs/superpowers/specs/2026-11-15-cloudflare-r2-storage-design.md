# Cloudflare R2 Object Storage & PostgreSQL Media Registry Design

**Date:** 2026-11-15
**Status:** Ready for Approval
**Scope:** Replace local filesystem storage (`uploads/`) with Cloudflare R2 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`) under a dedicated bucket prefix (`tovolana_writers/`), backed by Neon PostgreSQL metadata (`BookingFile` + `MediaAsset`), wired across private booking files, user/creator avatars, portfolio attachments, revision/dispute evidence, Admin Dispute Tribunal viewing, and an idempotent R2 migration/sync script.

---

## 1. Intent & Why

Tovolana Writers currently writes uploaded booking documents to local disk (`./uploads/<bookingId>/...` in `lib/storage.ts`) while storing `BookingFile` metadata in Neon PostgreSQL. On serverless/ephemeral deployments such as Vercel, local disk is neither persistent nor shared, and user avatars (`User.avatarUrl`), creator portfolio sample attachments, and revision/dispute evidence have no object storage pipeline.

This design switches document and uploaded media storage to **Cloudflare R2** using the shared `gtss` bucket isolated inside a dedicated folder prefix (`tovolana_writers/`), while keeping ownership, RBAC, and asset metadata authoritative in **Neon PostgreSQL**.

---

## 2. Recon Findings & Constraints

1. **Shared bucket isolation (`gtss`)**: Read-only `ListObjectsV2` on `gtss` shows sibling folders (`docs/`, `exports/`, `images/`, `medications/`, `moimashinani/`, `pharmacy-verification/`, `prescriptions/`, `products/`, `project-assets/`, `services/`, `symptom-uploads/`). Using `R2_KEY_PREFIX="tovolana_writers"` keeps all objects in `tovolana_writers/...` with zero collision.
2. **Bucket `gtss` has no CORS policy (`404 NoSuchCORSConfiguration`) & user chose Option A**: Bucket CORS stays untouched. All browser uploads route single-step through Next.js API routes -> server-side `PutObjectCommand` to R2, enforcing a **4 MB** upload cap cleanly in UI and API routes so browser payloads stay safely under Vercel Functions' ~4.5 MB body limit. (`lib/storage.ts` still provides `createPresignedUploadUrl` / `createPresignedDownloadUrl` helpers for backend/non-browser consumers.)
3. **Public `r2.dev` domain exposure vs. private deliverables**: `R2_PUBLIC_URL` (`https://pub-cc07856d657b4a7197710051042b3eda.r2.dev`) serves objects publicly by key.
   - Private booking files (`CUSTOMER_BRIEF`, `CREATOR_DELIVERABLE`, `REVISION_ATTACHMENT`, `DISPUTE_EVIDENCE`) MUST use high-entropy unguessable keys (`tovolana_writers/bookings/<bookingId>/<random16>-<safeName>`) and MUST ONLY be served via RBAC-gated `/api/files/[fileId]` streaming from R2 (`GetObjectCommand`), never returning raw `R2_PUBLIC_URL` links.
   - Public media (`USER_AVATAR`, `CREATOR_PORTFOLIO_IMAGE`, `CREATOR_PORTFOLIO_DOCUMENT`, `EDITORIAL_ASSET`) uses `tovolana_writers/media/...` and resolves via `NEXT_PUBLIC_R2_PUBLIC_URL`.
4. **Static `public/images/photos/` (user chose Option A)**: All 20 static editorial photos remain locally bundled in `public/images/photos/` for Next.js image optimization, while an idempotent script (`npm run storage:sync-r2`) mirrors them to `tovolana_writers/media/editorial/` on demand.
5. **Existing `./uploads/` & unknown staging DBs**: Neon `production` holds 1 DB-backed `BookingFile` (`brief-notes.txt` under `uploads/cmwhr92h2000vo3rq974c6mbp/`) alongside 13 unlinked leftover test directories on disk. We will migrate the 1 tracked file to R2, remove the 13 leftover local test directories, AND make the Prisma migration backfill-safe (`LOCAL` for any pre-existing unmigrated rows in any DB, `R2` default for all new rows).
6. **Existing category bug**: `app/creators-hub/bookings/[ref]/page.tsx` currently sends `"REVISION_DELIVERABLE"`, which isn't a valid Prisma `FileCategory` and silently fell back to `"CUSTOMER_BRIEF"`. Fixed to `"CREATOR_DELIVERABLE"`.

---

## 3. Goals, Non-Goals & Anti-Goals

### Goals
- Add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`, `NEXT_PUBLIC_R2_PUBLIC_URL`, `R2_ENDPOINT`, and `R2_KEY_PREFIX="tovolana_writers"` to `.env` (and placeholders to `.env.example`), replacing legacy `STORAGE_BUCKET_URL`.
- Replace local filesystem I/O in `lib/storage.ts` with Cloudflare R2 S3 SDK (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`), using local `./uploads` fallback ONLY when R2 credentials are unset (so offline CI in `.github/workflows/ci.yml` keeps passing) or when reading an unmigrated `storageProvider === "LOCAL"` DB row.
- Persist R2 metadata in Neon PostgreSQL (`BookingFile` extended + new `MediaAsset` model).
- Wire real uploads/renders across user avatars (`User.avatarUrl` in `/dashboard/settings`, `CreatorAvatar`, Nav/Shells/Listings/Creator profile), creator portfolio sample attachments, customer revision/dispute evidence, and Admin Dispute Tribunal evidence downloads (`/admin/bookings`).
- Migrate the 1 existing DB-tracked `BookingFile` into R2 (`tovolana_writers/bookings/...`), clean the 13 leftover `uploads/*` test folders, and provide `npm run storage:sync-r2` (`scripts/sync-r2.ts`).

### Non-Goals
- Modifying CORS, deleting objects outside `tovolana_writers/`, or changing settings on shared `gtss` bucket folders.
- Moving the 20 static `public/images/photos/` files away from Next.js local bundling at runtime.
- Modifying auth (`lib/auth.ts`), Redis (`lib/redis.ts`), or IntaSend (`lib/intasend.ts`).

### Anti-Goals
- Never expose `R2_PUBLIC_URL` for private `BookingFile` records.
- Never silently fall back to local disk when `storageProvider === "R2"` or `hasR2Config()` fails on an R2 upload/read (raise a clear error).
- Never commit `.env` secrets or live R2 keys to git.

---

## 4. Architecture & Technical Design

### 4.1 Environment & Next.js Config
- **`.env` / `.env.example` / `lib/env.ts`**:
  Configure `r2AccountId`, `r2AccessKeyId`, `r2SecretAccessKey`, `r2BucketName`, `r2PublicUrl`, `nextPublicR2PublicUrl`, `r2Endpoint`, `r2KeyPrefix` (default `"tovolana_writers"`), and helper `hasR2Config(): boolean` (checks account/endpoint, access key, secret key, and bucket name). Keep `storageSigningSecret`.
- **`next.config.ts`**:
  Add `pub-cc07856d657b4a7197710051042b3eda.r2.dev` (plus dynamic hostname parsed from `NEXT_PUBLIC_R2_PUBLIC_URL` / `R2_PUBLIC_URL` if non-empty) and `lh3.googleusercontent.com` to `images.remotePatterns`.

### 4.2 Prisma Schema & Backfill-Safe Migration (`prisma/schema.prisma`)
1. **`MediaAssetPurpose` enum**:
   `USER_AVATAR | CREATOR_PORTFOLIO_IMAGE | CREATOR_PORTFOLIO_DOCUMENT | EDITORIAL_ASSET | GENERAL`
2. **`MediaAsset` model**:
   - `id String @id @default(cuid())`
   - `ownerId String?` (`User?` relation `onDelete: SetNull`, `@@index([ownerId, purpose])`)
   - `purpose MediaAssetPurpose @default(GENERAL)`
   - `fileName String`, `mimeType String`, `sizeBytes Int`
   - `storageProvider String @default("R2")`
   - `bucket String?`, `storageKey String @unique`, `publicUrl String?`, `etag String?`
   - `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
3. **`BookingFile` extensions**:
   - `storageProvider String @default("R2")`
   - `bucket String?`
   - `etag String?`
   - `revisionId String?` / `disputeId String?` (optional traceability fields indexed by `bookingId`, non-breaking)
4. **Migration SQL strategy**:
   Add `BookingFile.storageProvider` with temporary `DEFAULT 'LOCAL'` so any pre-existing unmigrated rows in any database are accurately marked `'LOCAL'`, then `ALTER TABLE "BookingFile" ALTER COLUMN "storageProvider" SET DEFAULT 'R2'` so all new rows default to `'R2'`. Create `MediaAsset` table & `MediaAssetPurpose` enum. Run `npx prisma migrate dev` against Neon (`DATABASE_URL_UNPOOLED`).

### 4.3 Storage Driver (`lib/storage.ts`)
- Lazy `S3Client` (`@aws-sdk/client-s3`) with `region: "auto"`, `endpoint`, `credentials`, `requestChecksumCalculation: "WHEN_REQUIRED"`, `responseChecksumValidation: "WHEN_REQUIRED"`.
- **Key Namespacing** (`r2KeyPrefix` sanitized, no `..`, no leading/trailing slashes):
  - `createStorageKey(bookingId, fileName)` -> `${prefix}/bookings/${bookingId}/${random16}-${safeName}`
  - `createMediaStorageKey(folder, ownerSegment, fileName)` -> `${prefix}/media/${folder}/${ownerSegment}/${random8}-${safeName}`
- **Core functions**:
  - `writePrivateFile(storageKey, buffer, contentType?)` -> returns `{ storageKey, storageProvider: "R2" | "LOCAL", bucket, etag }`. Uses R2 `PutObjectCommand` when `hasR2Config()`, else writes local `./uploads` (CI fallback only).
  - `readPrivateFile(storageKey, storageProvider?)` -> if `storageProvider === "LOCAL"` (explicitly unmigrated/CI row) or `!hasR2Config()`, reads from `./uploads`; otherwise reads strictly from R2 `GetObjectCommand` (`transformToByteArray()`).
  - `writePublicMedia(storageKey, buffer, contentType)` -> uploads to R2 with `CacheControl: "public, max-age=31536000, immutable"` and builds `${publicBaseUrl}/${storageKey}`; when `!hasR2Config()` (CI), stores under `./uploads/_public/` and serves via `/api/media/[id]/raw` fallback.
  - `deleteStoredObject(storageKey, storageProvider?)` -> removes from R2 (`DeleteObjectCommand`) or local disk.
  - `createPresignedUploadUrl` / `createPresignedDownloadUrl` via `@aws-sdk/s3-request-presigner`.
- **Byte Limit Constant**: `MAX_BROWSER_UPLOAD_BYTES = 4 * 1024 * 1024` (4 MB) shared cleanly across client UI validation and server API route validation.

### 4.4 Backend API Contracts
1. **`POST /api/bookings/[ref]/files/presign`** (backward-compatible `{ ok: true, data: { file, downloadUrl } }`, HTTP `201`):
   - Validates booking participation (customer, assigned creator, or ADMIN).
   - Accepts `multipart/form-data` (`<= 4 MB`) or JSON (`contentBase64` / `contentText`, decoded `<= 4 MB`), rejects dangerous active content types (`text/html`, `image/svg+xml`, `application/javascript`, `application/x-msdownload`, etc.) and enforces allowed document/image MIME list (`pdf`, `doc`, `docx`, `txt`, `md`, `csv`, `xlsx`, `png`, `jpg`, `webp`, `zip`).
   - Uploads to R2 (`tovolana_writers/bookings/...`), creates `BookingFile` row with `storageProvider`, `bucket`, `etag`, `storageKey`, optional `revisionId`/`disputeId`, returns HMAC-signed `/api/files/${file.id}?exp=...&sig=...`.
2. **`GET /api/files/[fileId]`**:
   - Retains strict 401/403 RBAC & HMAC verification; calls `readPrivateFile(file.storageKey, file.storageProvider)` and streams bytes with `Content-Type`, sanitized `Content-Disposition`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`.
3. **`DELETE /api/files/[fileId]`** *(Escrow-safe)*:
   - Requires authentication (`401`).
   - Permitted if user is `ADMIN`, **or** user is the original `uploaderId` within 24h **AND** booking lifecycle permits removal (blocked once `booking.status` is `COMPLETED`, `DISPUTED`, `CANCELLED`, or `REFUNDED`, and `CREATOR_DELIVERABLE` is also blocked once `booking.status === "DELIVERED"`).
   - Deletes object from R2/local storage and deletes `BookingFile` row.
4. **`POST /api/media/upload` & `GET / DELETE /api/media/[id]`**:
   - `POST` (authenticated): accepts `multipart/form-data` (or JSON `contentBase64`), enforces `<= 4 MB` cap & strict purpose-specific MIME allowlist (`USER_AVATAR` / `CREATOR_PORTFOLIO_IMAGE`: `image/jpeg`, `image/png`, `image/webp`; `CREATOR_PORTFOLIO_DOCUMENT`: images + `application/pdf`, `text/plain`, `docx`).
   - Uploads to R2 (`tovolana_writers/media/<purposeFolder>/<userId>/...`), persists `MediaAsset` row in PostgreSQL. When `purpose === "USER_AVATAR"`, updates `User.avatarUrl` transactionally and removes the user's previous `USER_AVATAR` `MediaAsset` + R2 object.
   - `GET /api/media/[id]/raw`: local CI fallback stream ONLY when a `MediaAsset` has `storageProvider === "LOCAL"` (without R2); otherwise redirects/serves cleanly.
   - `DELETE /api/media/[id]`: allowed for asset `ownerId` or `ADMIN`; deletes R2 object + `MediaAsset` row, and clears `User.avatarUrl` if it matches `asset.publicUrl`.
5. **Serialization Updates**:
   - Include `avatarUrl` in `/api/tasks`, `/api/tasks/[slug]`, `/api/creators/[username]`, `/api/bookings/[ref]`, `/api/settings`, `/api/creators-hub/profile`.
   - Extend `portfolioSamples` Zod schema in `/api/creators-hub/profile` with optional `attachmentUrl`, `attachmentName`, `attachmentAssetId`, `mimeType`.
   - Include `booking.files` in `openDisputes` inside `/api/admin/overview` so Admin Dispute Tribunal receives uploaded `DISPUTE_EVIDENCE` and brief/deliverable files.

### 4.5 Frontend UI Updates
- **`components/ui/EditorialVisuals.tsx` & shells (`Navbar`, `CustomerShell`, `CreatorShell`, `TaskCard`, pages)**: `CreatorAvatar` accepts optional `avatarUrl?: string | null` and displays it when set, keeping deterministic local portrait fallback when `null`.
- **`app/dashboard/settings/page.tsx`**: Avatar preview, 4 MB image uploader (`/api/media/upload` `USER_AVATAR`), and remove avatar action (`DELETE /api/media/[id]`).
- **`app/creators-hub/profile/page.tsx` & `app/creators/[username]/page.tsx`**: Creator avatar upload + optional portfolio sample image/PDF/DOCX attachment upload rendered with clean preview/download link on public creator profiles.
- **`app/dashboard/bookings/[bookingRef]/revision/page.tsx` & `dispute/page.tsx`**: Optional supporting attachment input (<= 4 MB) uploading via `/api/bookings/[ref]/files/presign` (`REVISION_ATTACHMENT` / `DISPUTE_EVIDENCE`).
- **`app/dashboard/bookings/[bookingRef]/page.tsx` & `app/creators-hub/bookings/[ref]/page.tsx`**: Show 4 MB upload hint, delete button only when lifecycle permits, and fix deliverable category bug (`"CREATOR_DELIVERABLE"`).
- **`app/admin/bookings/page.tsx`**: Display downloadable `booking.files` evidence list inside each card in the Escrow Dispute Tribunal.

### 4.6 Migration & Sync Script (`scripts/sync-r2.ts` / `npm run storage:sync-r2`)
- Idempotent script that:
  1. Finds any `BookingFile` rows with `storageProvider = "LOCAL"` whose file exists under `./uploads/`, uploads them to `tovolana_writers/bookings/<bookingId>/...` in R2, updates `storageProvider = "R2"`, `bucket`, `storageKey`, `etag`, and logs summary.
  2. When passed `--with-editorial` (or default behavior during manual backup), uploads `public/images/photos/*` to `tovolana_writers/media/editorial/...` and upserts `MediaAsset` (`EDITORIAL_ASSET`) rows in Neon PostgreSQL without altering runtime local `/images/photos/` references.
  3. After verified migration of the 1 existing Neon `BookingFile` (`brief-notes.txt`), removes the 13 leftover unlinked `uploads/*` local test subdirectories.

---

## 5. Decisions & Engineering Calls Summary (For Review)

1. **User-confirmed choices**: Shared `gtss` bucket CORS remains untouched with **4 MB** single-step server-proxied browser upload caps; 20 static images in `public/images/photos/` remain local at runtime with an idempotent `npm run storage:sync-r2` mirror script; migrate the 1 tracked `BookingFile` to R2 and remove the 13 leftover local test folders.
2. **Engineering Call — Backfill-safe SQL migration**: Pre-existing `BookingFile` rows in any DB backfill to `storageProvider = 'LOCAL'`, while all new rows default to `'R2'`; `readPrivateFile` checks `storageProvider === 'LOCAL'` for legacy rows and reads strictly from R2 when `storageProvider === 'R2'`.
3. **Engineering Call — Lifecycle-locked file deletion**: Non-admin file deletion is blocked once a booking reaches `COMPLETED`, `DISPUTED`, `CANCELLED`, or `REFUNDED` (and `CREATOR_DELIVERABLE` deletion is blocked once `DELIVERED`), preserving escrow & dispute integrity.
4. **Engineering Call — Admin Dispute Tribunal evidence**: Added `booking.files` to `/api/admin/overview` `openDisputes` and rendered evidence download links in `/admin/bookings`.
5. **Engineering Call — Deliverable category bug fix**: Updated `app/creators-hub/bookings/[ref]/page.tsx` from invalid `"REVISION_DELIVERABLE"` to `"CREATOR_DELIVERABLE"`.
6. **Engineering Call — Leave unrelated `.env` services intact**: Only update `.env` / `.env.example` with the Cloudflare R2 block (`R2_*`, `NEXT_PUBLIC_R2_PUBLIC_URL`, `R2_KEY_PREFIX="tovolana_writers"`), without altering Redis/Firebase/IntaSend keys.

---

## 6. Verification Plan
- Unit & integration checks (`npm test`) covering R2 key isolation (`tovolana_writers/...`), `BookingFile` persistence & 403 IDOR checks, lifecycle-gated deletion, `MediaAsset` avatar upload + `User.avatarUrl` sync + HTML/SVG XSS rejection, and 4 MB limit enforcement.
- Live Cloudflare R2 verification: execute actual S3 `PutObject` / `GetObject` / `DeleteObject` against `gtss` under `tovolana_writers/`, apply Prisma migration to Neon `production`, run `npm run storage:sync-r2` to migrate `brief-notes.txt` & clean stale `uploads/*`, then run `npx next typegen && npx tsc --noEmit && npm run lint && npm test && npm run build`, start `next start`, and test end-to-end HTTP file & avatar upload -> Neon DB -> R2 -> RBAC download.
