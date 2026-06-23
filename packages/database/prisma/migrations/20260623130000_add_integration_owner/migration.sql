-- AlterTable: add owner_id to bind integration accounts to a user
-- (nullable for backward-compatibility with existing rows)
ALTER TABLE "integration_accounts" ADD COLUMN "owner_id" TEXT;

-- AddForeignKey
ALTER TABLE "integration_accounts"
ADD CONSTRAINT "integration_accounts_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
