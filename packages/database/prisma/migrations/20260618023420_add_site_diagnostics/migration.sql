-- CreateTable
CREATE TABLE "site_diagnostics" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "ssl_expires_at" TIMESTAMP(3),
    "ssl_issuer" TEXT,
    "ssl_status" TEXT,
    "disk_total_bytes" DOUBLE PRECISION,
    "disk_used_bytes" DOUBLE PRECISION,
    "cron_health_status" TEXT NOT NULL DEFAULT 'OK',
    "cron_details_json" JSONB,
    "last_diagnostics_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_diagnostics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_diagnostics_site_id_key" ON "site_diagnostics"("site_id");

-- AddForeignKey
ALTER TABLE "site_diagnostics" ADD CONSTRAINT "site_diagnostics_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
