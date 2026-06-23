"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";

export default function AccountPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  return (
    <>
      <Header title="Account" subtitle="Manage your profile and security" />
      <main className="wpcc-scroll flex-1 overflow-auto bg-[var(--muted)] p-[24px]">
        <div className="max-w-[720px] mx-auto flex flex-col gap-[24px]">
          {/* Profile Card */}
          <div className="bg-[var(--card)] border border-[var(--border)] p-[24px] flex items-center gap-[20px]">
            <div className="w-[64px] h-[64px] flex-none rounded-full bg-[var(--muted)] text-[var(--foreground)] flex items-center justify-center text-[24px] font-bold font-heading">
              AD
            </div>
            <div>
              <h2 className="font-heading font-bold text-[20px]">Admin</h2>
              <p className="text-[13px] text-[var(--muted-foreground)] mt-[2px]">admin@example.com</p>
              <span className="inline-flex items-center mt-[6px] px-[8px] py-[2px] bg-[color-mix(in_oklch,var(--primary)_24%,white)] text-[var(--primary-foreground)] text-[11px] font-semibold">
                SUPER_ADMIN
              </span>
            </div>
          </div>

          {/* Change Password */}
          <div className="bg-[var(--card)] border border-[var(--border)] p-[24px] flex flex-col gap-[16px]">
            <h3 className="font-heading font-semibold text-[16px]">Change Password</h3>
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-semibold text-[var(--muted-foreground)]">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-[40px] px-[12px] border border-[var(--input)] bg-[var(--background)] text-[13.5px] outline-none max-w-[400px]"
              />
            </div>
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-semibold text-[var(--muted-foreground)]">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-[40px] px-[12px] border border-[var(--input)] bg-[var(--background)] text-[13.5px] outline-none max-w-[400px]"
              />
            </div>
            <div className="flex justify-end">
              <Button disabled={!currentPassword || !newPassword}>Update Password</Button>
            </div>
          </div>

          {/* Active Sessions */}
          <div className="bg-[var(--card)] border border-[var(--border)] p-[24px] flex flex-col gap-[16px]">
            <h3 className="font-heading font-semibold text-[16px]">Active Sessions</h3>
            <div className="border border-[var(--border)]">
              <div className="flex items-center justify-between px-[16px] py-[12px] border-b border-[var(--border)]">
                <div>
                  <div className="text-[13px] font-medium">Chrome on macOS</div>
                  <div className="text-[11px] text-[var(--muted-foreground)]">IP: 192.168.1.100 · Last active: now</div>
                </div>
                <span className="w-[8px] h-[8px] rounded-full bg-[var(--success)]" />
              </div>
              <div className="flex items-center justify-between px-[16px] py-[12px]">
                <div>
                  <div className="text-[13px] font-medium">Safari on macOS</div>
                  <div className="text-[11px] text-[var(--muted-foreground)]">IP: 192.168.1.100 · Last active: 2h ago</div>
                </div>
                <button className="text-[12px] text-[var(--danger)] hover:underline">Revoke</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
