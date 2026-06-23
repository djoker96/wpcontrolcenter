"use client";

import { Header } from "@/components/layout/Header";
import { BulkUploadForm } from "@/components/updates/BulkUploadForm";

export default function BulkUploadPage() {
  return (
    <>
      <Header
        title="Bulk Upload"
        subtitle="Upload a .zip update to multiple sites at once"
      />
      <main className="wpcc-scroll flex-1 overflow-auto bg-[var(--muted)] p-[24px]">
        <div className="max-w-[640px]">
          <BulkUploadForm />
        </div>
      </main>
    </>
  );
}
