-- DropForeignKey
ALTER TABLE "site_integrations" DROP CONSTRAINT "site_integrations_integration_account_id_fkey";

-- AddForeignKey
ALTER TABLE "site_integrations" ADD CONSTRAINT "site_integrations_integration_account_id_fkey" FOREIGN KEY ("integration_account_id") REFERENCES "integration_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
