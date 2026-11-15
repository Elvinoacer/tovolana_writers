import fs from "fs/promises";
import path from "path";
import { MediaAssetPurpose } from "@prisma/client";

type DbClient = typeof import("@/lib/db")["db"];
type StorageModule = typeof import("@/lib/storage");

const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");
const PUBLIC_LOCAL_ROOT = path.resolve(UPLOADS_ROOT, "_public");
const EDITORIAL_ROOT = path.resolve(process.cwd(), "public", "images", "photos");

const EDITORIAL_MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

interface SyncOptions {
  withEditorial: boolean;
  pruneUnlinked: boolean;
}

function parseCliArgs(argv: string[]): SyncOptions {
  const unknown: string[] = [];
  let withEditorial = false;
  let pruneUnlinked = false;

  for (const arg of argv) {
    if (arg === "--with-editorial") {
      withEditorial = true;
    } else if (arg === "--prune-unlinked") {
      pruneUnlinked = true;
    } else if (arg === "--") {
      continue;
    } else {
      unknown.push(arg);
    }
  }

  if (unknown.length > 0) {
    throw new Error(
      `Unknown argument(s): ${unknown.join(", ")}. Supported flags: --with-editorial, --prune-unlinked`
    );
  }

  return { withEditorial, pruneUnlinked };
}

async function loadEnvironment(): Promise<void> {
  try {
    const { loadEnvConfig } = await import("@next/env");
    loadEnvConfig(
      process.cwd(),
      process.env.NODE_ENV !== "production",
      { info: () => undefined, error: console.error }
    );
    return;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== "MODULE_NOT_FOUND" && code !== "ERR_MODULE_NOT_FOUND") {
      throw err;
    }
  }

  const dotenv = await import("dotenv");
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}

function resolveContainedPath(root: string, relativeKey: string): string {
  const resolvedRoot = path.resolve(root);
  const targetPath = path.resolve(resolvedRoot, relativeKey);
  if (!targetPath.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`INVALID_STORAGE_PATH: ${relativeKey}`);
  }
  return targetPath;
}

async function removeEmptyParentDirs(
  startDir: string,
  stopRoot: string
): Promise<number> {
  const resolvedRoot = path.resolve(stopRoot);
  let current = path.resolve(startDir);
  let removed = 0;

  while (current.startsWith(resolvedRoot + path.sep)) {
    let entries: string[];
    try {
      entries = await fs.readdir(current);
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        current = path.dirname(current);
        continue;
      }
      throw err;
    }

    if (entries.length > 0) {
      break;
    }

    await fs.rmdir(current);
    removed += 1;
    current = path.dirname(current);
  }

  return removed;
}

async function migrateLocalBookingFiles(
  db: DbClient,
  storage: StorageModule
): Promise<{
  scanned: number;
  migrated: number;
  failed: number;
}> {
  const prefix = storage.getR2KeyPrefix();
  const localFiles = await db.bookingFile.findMany({
    where: { storageProvider: "LOCAL" },
    orderBy: { createdAt: "asc" },
  });

  let migrated = 0;
  let failed = 0;

  for (const file of localFiles) {
    try {
      if (!storage.validateBookingUploadMime(file.mimeType, file.fileName)) {
        throw new Error(
          `Blocked or mismatched MIME/extension (${file.mimeType}, ${file.fileName})`
        );
      }

      const buffer = await storage.readPrivateFile(file.storageKey, "LOCAL");
      const targetKey = file.storageKey.startsWith(`${prefix}/bookings/`)
        ? storage.assertScopedStorageKey(file.storageKey)
        : storage.createStorageKey(file.bookingId, file.fileName);

      const stored = await storage.writePrivateFile(
        targetKey,
        buffer,
        file.mimeType
      );

      try {
        await db.bookingFile.update({
          where: { id: file.id },
          data: {
            storageProvider: stored.storageProvider,
            bucket: stored.bucket,
            storageKey: stored.storageKey,
            etag: stored.etag,
            sizeBytes: stored.sizeBytes,
          },
        });
      } catch (dbErr) {
        await storage
          .deleteStoredObject(stored.storageKey, stored.storageProvider)
          .catch(() => undefined);
        throw dbErr;
      }

      try {
        await storage.deleteStoredObject(file.storageKey, "LOCAL");
        const legacyLocalPath = resolveContainedPath(
          UPLOADS_ROOT,
          storage.assertScopedStorageKey(file.storageKey, {
            allowLegacyLocal: true,
          })
        );
        await removeEmptyParentDirs(path.dirname(legacyLocalPath), UPLOADS_ROOT);
      } catch (cleanupErr) {
        console.warn(
          `[booking-file] Warning: migrated DB to R2 for ${file.id} (${stored.storageKey}) but failed local cleanup (${file.storageKey}):`,
          cleanupErr instanceof Error ? cleanupErr.message : cleanupErr
        );
      }

      migrated += 1;
      console.log(
        `[booking-file] Migrated ${file.id} (${file.fileName}): LOCAL:${file.storageKey} -> R2:${stored.storageKey}`
      );
    } catch (err) {
      failed += 1;
      console.error(
        `[booking-file] Failed to migrate ${file.id} (${file.storageKey}):`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return { scanned: localFiles.length, migrated, failed };
}

async function collectFilesSorted(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return [];
    }
    throw err;
  }

  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  const files: string[] = [];

  for (const entry of sorted) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFilesSorted(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function buildEditorialStorageKey(
  storage: StorageModule,
  relativeFilePath: string
): {
  storageKey: string;
  safeFileName: string;
} {
  const segments = relativeFilePath.split(path.sep).filter(Boolean);
  if (segments.length === 0) {
    throw new Error(`Invalid editorial relative path: ${relativeFilePath}`);
  }
  const rawName = segments[segments.length - 1];
  const safeFileName = storage.sanitizeFileName(rawName);
  const safeDirs = segments
    .slice(0, -1)
    .map((seg) => storage.sanitizePathSegment(seg, "dir"));
  const safeRelPath = [...safeDirs, safeFileName].join("/");
  const storageKey = storage.assertScopedStorageKey(
    `${storage.getR2KeyPrefix()}/media/editorial/${safeRelPath}`
  );
  return { storageKey, safeFileName };
}

async function syncEditorialAssets(
  db: DbClient,
  storage: StorageModule,
  maxUploadBytes: number
): Promise<{
  scanned: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}> {
  const allFiles = await collectFilesSorted(EDITORIAL_ROOT);
  const prefix = storage.getR2KeyPrefix();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const fullPath of allFiles) {
    const ext = path.extname(fullPath).toLowerCase();
    const mimeType = EDITORIAL_MIME_BY_EXT[ext];
    if (!mimeType) {
      skipped += 1;
      continue;
    }

    const relPath = path.relative(EDITORIAL_ROOT, fullPath);
    try {
      const { storageKey, safeFileName } = buildEditorialStorageKey(
        storage,
        relPath
      );
      if (!storageKey.startsWith(`${prefix}/media/editorial/`)) {
        throw new Error(`Unexpected editorial storageKey scope: ${storageKey}`);
      }
      if (
        !storage.validateMediaUploadMime(
          mimeType,
          MediaAssetPurpose.EDITORIAL_ASSET,
          safeFileName
        )
      ) {
        throw new Error(`Unsupported editorial asset MIME: ${mimeType}`);
      }

      const buffer = await fs.readFile(fullPath);
      if (buffer.byteLength === 0 || buffer.byteLength > maxUploadBytes) {
        throw new Error(
          `Editorial asset size (${buffer.byteLength} bytes) is out of allowed bounds (1..${maxUploadBytes}).`
        );
      }

      const existing = await db.mediaAsset.findUnique({
        where: { storageKey },
        select: { id: true },
      });

      const stored = await storage.writePublicMedia(storageKey, buffer, mimeType);
      try {
        await db.mediaAsset.upsert({
          where: { storageKey: stored.storageKey },
          update: {
            ownerId: null,
            purpose: MediaAssetPurpose.EDITORIAL_ASSET,
            fileName: safeFileName,
            mimeType,
            sizeBytes: stored.sizeBytes,
            storageProvider: stored.storageProvider,
            bucket: stored.bucket,
            publicUrl: stored.publicUrl,
            etag: stored.etag,
          },
          create: {
            ownerId: null,
            purpose: MediaAssetPurpose.EDITORIAL_ASSET,
            fileName: safeFileName,
            mimeType,
            sizeBytes: stored.sizeBytes,
            storageProvider: stored.storageProvider,
            bucket: stored.bucket,
            storageKey: stored.storageKey,
            publicUrl: stored.publicUrl,
            etag: stored.etag,
          },
        });
      } catch (dbErr) {
        if (!existing) {
          await storage
            .deleteStoredObject(stored.storageKey, stored.storageProvider)
            .catch(() => undefined);
        }
        throw dbErr;
      }

      if (existing) {
        updated += 1;
      } else {
        created += 1;
      }

      console.log(
        `[editorial] ${existing ? "Synced" : "Created"} ${stored.storageKey} -> ${stored.publicUrl ?? "no-public-url"}`
      );
    } catch (err) {
      failed += 1;
      console.error(
        `[editorial] Failed to sync ${relPath}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return {
    scanned: allFiles.length,
    created,
    updated,
    skipped,
    failed,
  };
}

async function pruneDirectoryRecursive(
  dirPath: string,
  protectedFiles: Set<string>,
  isRoot: boolean
): Promise<{ deletedFiles: number; deletedDirs: number; preservedFiles: number }> {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return { deletedFiles: 0, deletedDirs: 0, preservedFiles: 0 };
    }
    throw err;
  }

  let deletedFiles = 0;
  let deletedDirs = 0;
  let preservedFiles = 0;

  for (const entry of entries) {
    const fullPath = path.resolve(dirPath, entry.name);
    if (entry.isDirectory()) {
      const sub = await pruneDirectoryRecursive(fullPath, protectedFiles, false);
      deletedFiles += sub.deletedFiles;
      deletedDirs += sub.deletedDirs;
      preservedFiles += sub.preservedFiles;
    } else if (protectedFiles.has(fullPath)) {
      preservedFiles += 1;
    } else {
      await fs.unlink(fullPath);
      deletedFiles += 1;
    }
  }

  if (!isRoot) {
    const remaining = await fs.readdir(dirPath);
    if (remaining.length === 0) {
      await fs.rmdir(dirPath);
      deletedDirs += 1;
    }
  }

  return { deletedFiles, deletedDirs, preservedFiles };
}

async function pruneUnlinkedLocalFiles(
  db: DbClient,
  storage: StorageModule
): Promise<{
  deletedFiles: number;
  deletedDirs: number;
  preservedFiles: number;
}> {
  try {
    await fs.stat(UPLOADS_ROOT);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return { deletedFiles: 0, deletedDirs: 0, preservedFiles: 0 };
    }
    throw err;
  }

  const [remainingLocalBookings, remainingLocalMedia] = await Promise.all([
    db.bookingFile.findMany({
      where: { storageProvider: "LOCAL" },
      select: { storageKey: true },
    }),
    db.mediaAsset.findMany({
      where: { storageProvider: "LOCAL" },
      select: { storageKey: true },
    }),
  ]);

  const protectedFiles = new Set<string>();

  for (const row of remainingLocalBookings) {
    try {
      const scoped = storage.assertScopedStorageKey(row.storageKey, {
        allowLegacyLocal: true,
      });
      protectedFiles.add(resolveContainedPath(UPLOADS_ROOT, scoped));
    } catch {
      // Invalid key cannot map cleanly; skip adding unsafe path
    }
  }

  for (const row of remainingLocalMedia) {
    try {
      const scoped = storage.assertScopedStorageKey(row.storageKey);
      protectedFiles.add(resolveContainedPath(PUBLIC_LOCAL_ROOT, scoped));
    } catch {
      // Invalid key cannot map cleanly; skip adding unsafe path
    }
  }

  return pruneDirectoryRecursive(UPLOADS_ROOT, protectedFiles, true);
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  await loadEnvironment();

  const { env, hasR2Config, MAX_BROWSER_UPLOAD_BYTES } = await import(
    "@/lib/env"
  );

  if (!hasR2Config()) {
    console.error(
      "Refusing to run R2 sync: Cloudflare R2 credentials/bucket are not configured (check R2_ACCOUNT_ID/R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)."
    );
    process.exitCode = 1;
    return;
  }

  const [{ closeDbConnections, db }, storage] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/storage"),
  ]);

  try {
    const prefix = storage.getR2KeyPrefix();
    console.log(
      `Starting R2 sync (bucket=${env.r2BucketName}, prefix=${prefix}/, withEditorial=${options.withEditorial}, pruneUnlinked=${options.pruneUnlinked})`
    );

    const bookingStats = await migrateLocalBookingFiles(db, storage);
    console.log(
      `Booking files summary: scanned=${bookingStats.scanned}, migrated=${bookingStats.migrated}, failed=${bookingStats.failed}`
    );

    let editorialFailed = 0;
    if (options.withEditorial) {
      const editorialStats = await syncEditorialAssets(
        db,
        storage,
        MAX_BROWSER_UPLOAD_BYTES
      );
      editorialFailed = editorialStats.failed;
      console.log(
        `Editorial assets summary: scanned=${editorialStats.scanned}, created=${editorialStats.created}, updated=${editorialStats.updated}, skipped=${editorialStats.skipped}, failed=${editorialStats.failed}`
      );
    }

    if (options.pruneUnlinked) {
      const pruneStats = await pruneUnlinkedLocalFiles(db, storage);
      console.log(
        `Local uploads prune summary: deletedFiles=${pruneStats.deletedFiles}, deletedDirs=${pruneStats.deletedDirs}, preservedLocalFiles=${pruneStats.preservedFiles}`
      );
    }

    if (bookingStats.failed > 0 || editorialFailed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await closeDbConnections();
  }
}

main().catch((err) => {
  console.error("R2 sync failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
