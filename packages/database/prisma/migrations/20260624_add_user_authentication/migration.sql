CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE');

ALTER TABLE "users"
  ALTER COLUMN "password_hash" DROP NOT NULL,
  ADD COLUMN "email_verified_at" TIMESTAMP(3);

UPDATE "users"
SET "email_verified_at" = CURRENT_TIMESTAMP
WHERE "email_verified_at" IS NULL;

CREATE TABLE "auth_identities" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" "AuthProvider" NOT NULL,
  "provider_account_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_verification_codes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_identities_provider_provider_account_id_key"
  ON "auth_identities"("provider", "provider_account_id");
CREATE UNIQUE INDEX "auth_identities_user_id_provider_key"
  ON "auth_identities"("user_id", "provider");
CREATE INDEX "auth_identities_user_id_idx" ON "auth_identities"("user_id");
CREATE INDEX "email_verification_codes_user_id_idx" ON "email_verification_codes"("user_id");
CREATE INDEX "email_verification_codes_expires_at_idx" ON "email_verification_codes"("expires_at");

ALTER TABLE "auth_identities"
  ADD CONSTRAINT "auth_identities_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_verification_codes"
  ADD CONSTRAINT "email_verification_codes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
