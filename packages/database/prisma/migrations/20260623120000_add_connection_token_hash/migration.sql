-- Add indexed keyed-hash lookup column for agent connection tokens.
-- Lets registration find the matching credential by hash instead of decrypting
-- every row (removes the token-guessing oracle + CPU-amplification DoS).
ALTER TABLE "site_credentials" ADD COLUMN "connection_token_hash" TEXT;

CREATE UNIQUE INDEX "site_credentials_connection_token_hash_key" ON "site_credentials"("connection_token_hash");
