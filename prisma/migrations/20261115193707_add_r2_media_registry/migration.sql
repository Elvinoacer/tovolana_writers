-- CreateEnum
CREATE TYPE "MediaAssetPurpose" AS ENUM ('USER_AVATAR', 'CREATOR_PORTFOLIO_IMAGE', 'CREATOR_PORTFOLIO_DOCUMENT', 'EDITORIAL_ASSET', 'GENERAL');

-- AlterTable
ALTER TABLE "BookingFile" ADD COLUMN     "bucket" TEXT,
ADD COLUMN     "disputeId" TEXT,
ADD COLUMN     "etag" TEXT,
ADD COLUMN     "revisionId" TEXT,
ADD COLUMN     "storageProvider" TEXT NOT NULL DEFAULT 'LOCAL';

-- AlterTable
ALTER TABLE "BookingFile" ALTER COLUMN "storageProvider" SET DEFAULT 'R2';

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "purpose" "MediaAssetPurpose" NOT NULL DEFAULT 'GENERAL',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'R2',
    "bucket" TEXT,
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT,
    "etag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MediaAsset_ownerId_purpose_idx" ON "MediaAsset"("ownerId", "purpose");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
