-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BackupType" AS ENUM ('FULL', 'DATABASE', 'FILES');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobType" ADD VALUE 'CREATE_BACKUP';
ALTER TYPE "JobType" ADD VALUE 'RESTORE_BACKUP';

-- CreateTable
CREATE TABLE "site_backups" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "backup_type" "BackupType" NOT NULL,
    "filename" TEXT NOT NULL,
    "size_bytes" DOUBLE PRECISION,
    "status" "BackupStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "download_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_backups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_backups_site_id_idx" ON "site_backups"("site_id");

-- AddForeignKey
ALTER TABLE "site_backups" ADD CONSTRAINT "site_backups_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
