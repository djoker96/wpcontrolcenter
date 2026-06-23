"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("wpcc_token");
    if (!token) {
      router.push("/");
    } else {
        Promise.resolve().then(() => setAuthed(true));
    }
    Promise.resolve().then(() => setInitialized(true));
  }, [router]);

  if (!initialized || !authed) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[var(--background)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh bg-[var(--background)] text-[var(--foreground)]">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        {children}
      </div>
    </div>
  );
}
