-- CreateTable
CREATE TABLE "site_performance_audits" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "performance_score" INTEGER NOT NULL,
    "accessibility_score" INTEGER NOT NULL,
    "best_practices_score" INTEGER NOT NULL,
    "seo_score" INTEGER NOT NULL,
    "lcp_ms" DOUBLE PRECISION,
    "inp_ms" DOUBLE PRECISION,
    "cls" DOUBLE PRECISION,
    "audited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_performance_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_performance_audits_site_id_idx" ON "site_performance_audits"("site_id");

-- AddForeignKey
ALTER TABLE "site_performance_audits" ADD CONSTRAINT "site_performance_audits_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
