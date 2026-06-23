-- AlterEnum
ALTER TYPE "JobTargetType" ADD VALUE 'OBJECT_CACHE';

-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'TOGGLE_OBJECT_CACHE';

-- AlterTable
ALTER TABLE "sites" ADD COLUMN     "object_cache_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "object_cache_type" TEXT DEFAULT 'Redis';
