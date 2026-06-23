-- AlterTable: add token_version for JWT revocation support
ALTER TABLE "users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
