"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";

type Step = 1 | 2 | 3;
type Method = "admin" | "manual";

function StepIndicator({ num, label, currentStep }: { num: number; label: string; currentStep: Step }) {
  const isDone = currentStep > num;
  const isActive = currentStep === num;
  return (
    <span className="inline-flex items-center gap-[9px] flex-none">
      <span
        className={`w-[24px] h-[24px] flex-none flex items-center justify-center text-[12px] font-bold ${
          isDone || isActive
            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
            : "border border-[var(--border)] text-[var(--muted-foreground)]"
        }`}
      >
        {isDone ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        ) : (
          num
        )}
      </span>
      <span className={`text-[13px] whitespace-nowrap ${isActive ? "text-[var(--foreground)] font-semibold" : "text-[var(--muted-foreground)] font-medium"}`}>
        {label}
      </span>
    </span>
  );
}

export default function AddSitePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [method, setMethod] = useState<Method>("admin");
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState(false);

  // Form state
  const [siteUrl, setSiteUrl] = useState("");
  const [environment, setEnvironment] = useState("PRODUCTION");
  const [token, setToken] = useState("");

  const goNext = async () => {
    if (step === 1) {
      // Create site and get token
      try {
        const domain = new URL(siteUrl).hostname;
        const body = await api.post<{ id: string; connectionToken: string; name: string }>("/sites", {
          name: domain,
          siteUrl,
          domain,
          environment,
        });
        setToken(body.connectionToken);
        setStep(2);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to create site";
        alert(msg);
      }
    } else if (step === 2) {
      setStep(3);
      setChecking(true);
      // Simulate verification (in production, poll heartbeat)
      setTimeout(() => {
        setChecking(false);
        setVerified(true);
      }, 2600);
    } else if (step === 3 && verified) {
      router.push("/sites");
    }
  };

  const goBack = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as Step);
      setChecking(false);
      setVerified(false);
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {/* Breadcrumb */}
      <header className="h-[60px] flex-none border-b border-[var(--border)] px-[24px] flex items-center gap-[6px] text-[12px] text-[var(--muted-foreground)] bg-[var(--background)]">
        <Link href="/sites" className="hover:text-[var(--foreground)]">Sites</Link>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        <span className="text-[var(--foreground)] font-medium">Add site</span>
      </header>

      <main className="wpcc-scroll flex-1 overflow-auto bg-[var(--muted)] p-[32px] flex justify-center items-start">
        <div className="w-[720px] max-w-full bg-[var(--card)] border border-[var(--border)]">
          {/* Card header */}
          <div className="px-[26px] py-[22px] border-b border-[var(--border)]">
            <div className="font-heading font-bold text-[20px] tracking-tight">Connect a WordPress site</div>
            <div className="text-[13px] text-[var(--muted-foreground)] mt-[4px]">Install the agent plugin, then we sync inventory automatically.</div>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-[10px] px-[26px] pt-[20px]">
            <StepIndicator num={1} label="Site URL" currentStep={step} />
            <span className={`flex-1 h-[2px] ${step > 1 ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`} />
            <StepIndicator num={2} label="Install agent" currentStep={step} />
            <span className={`flex-1 h-[2px] ${step > 2 ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`} />
            <StepIndicator num={3} label="Verify & sync" currentStep={step} />
          </div>

          {/* Step 1: Site URL */}
          {step === 1 && (
            <div className="px-[26px] pt-[24px] pb-[18px] flex flex-col gap-[18px]">
              <div className="flex flex-col gap-[7px]">
                <label className="text-[12.5px] font-medium">Site URL</label>
                <input
                  type="url"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="h-[40px] px-[12px] border border-[var(--input)] bg-[var(--background)] text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                />
              </div>
              <div className="flex gap-[16px]">
                <div className="flex-1 flex flex-col gap-[7px]">
                  <label className="text-[12.5px] font-medium">Environment</label>
                  <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    className="h-[40px] px-[12px] border border-[var(--input)] bg-[var(--background)] text-[13.5px] text-[var(--foreground)] outline-none"
                  >
                    <option value="PRODUCTION">Production</option>
                    <option value="STAGING">Staging</option>
                    <option value="DEVELOPMENT">Development</option>
                  </select>
                </div>
                <div className="flex-1 flex flex-col gap-[7px]">
                  <label className="text-[12.5px] font-medium">Tags</label>
                  <div className="h-[40px] px-[10px] border border-[var(--input)] bg-[var(--background)] flex items-center gap-[6px] text-[13px] text-[var(--muted-foreground)]">
                    Add tag…
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Install agent */}
          {step === 2 && (
            <div className="px-[26px] pt-[24px] pb-[18px] flex flex-col gap-[20px]">
              {/* Method selector */}
              <div className="flex flex-col gap-[8px]">
                <span className="text-[12.5px] font-medium">Installation method</span>
                <div className="border border-[var(--border)] flex flex-col">
                  <button
                    onClick={() => setMethod("admin")}
                    className="flex items-center gap-[14px] px-[16px] py-[14px] border-b border-[var(--border)] hover:bg-[var(--accent)] text-left"
                  >
                    <span className={`w-[16px] h-[16px] flex-none rounded-full border-[1.5px] ${method === "admin" ? "border-[5px] border-[var(--primary)] bg-[var(--background)]" : "border-[var(--border)]"}`} />
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold flex items-center gap-[8px]">
                        WordPress Admin
                        <span className="text-[11px] font-semibold text-[var(--primary-foreground)] bg-[var(--primary)] px-[7px] py-[1px]">Recommended</span>
                      </div>
                      <div className="text-[12px] text-[var(--muted-foreground)] mt-[2px]">Search and install from your WP dashboard</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setMethod("manual")}
                    className="flex items-center gap-[14px] px-[16px] py-[14px] hover:bg-[var(--accent)] text-left"
                  >
                    <span className={`w-[16px] h-[16px] flex-none rounded-full border-[1.5px] ${method === "manual" ? "border-[5px] border-[var(--primary)] bg-[var(--background)]" : "border-[var(--border)]"}`} />
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold">Manual upload</div>
                      <div className="text-[12px] text-[var(--muted-foreground)] mt-[2px]">Download the ZIP and upload via WP admin</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-[var(--muted)] border border-[var(--border)] p-[20px] flex flex-col gap-[14px]">
                <div className="text-[12.5px] font-semibold">Steps</div>
                {method === "admin" ? (
                  <div className="flex flex-col gap-[11px]">
                    {[
                      "Log in to example.com/wp-admin",
                      "Go to Plugins → Add New Plugin",
                      "Search for WP Control Center Agent, click Install Now then Activate",
                      "Go to Settings → WP Control Center and paste your connection token",
                    ].map((text, i) => (
                      <div key={i} className="flex gap-[13px] items-start">
                        <span className="w-[22px] h-[22px] flex-none bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center text-[11px] font-bold">{i + 1}</span>
                        <span className="text-[13px] leading-[1.55] pt-[2px]">{text}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-[11px]">
                    <div className="flex items-center gap-[12px] mb-[4px]">
                      <span className="inline-flex items-center gap-[8px] h-[36px] px-[15px] bg-[var(--foreground)] text-[var(--background)] text-[12.5px] font-semibold cursor-pointer">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                        Download plugin ZIP
                      </span>
                      <span className="text-[12px] text-[var(--muted-foreground)]">v2.4.1 · 142 KB</span>
                    </div>
                    {[
                      "In WP Admin go to Plugins → Add New → Upload Plugin",
                      "Upload the downloaded ZIP and click Install Now → Activate",
                      "Go to Settings → WP Control Center and paste your connection token",
                    ].map((text, i) => (
                      <div key={i} className="flex gap-[13px] items-start">
                        <span className="w-[22px] h-[22px] flex-none bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center text-[11px] font-bold">{i + 1}</span>
                        <span className="text-[13px] leading-[1.55] pt-[2px]">{text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Token display */}
                <div className="flex items-center gap-[8px] px-[12px] py-[10px] border border-[var(--border)] bg-[var(--background)]">
                  <div className="flex-1 font-mono text-[12px] text-[var(--muted-foreground)] truncate select-all">{token}</div>
                  <button
                    onClick={() => navigator.clipboard.writeText(token)}
                    className="inline-flex items-center gap-[5px] text-[12px] font-semibold px-[11px] py-[5px] border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)]"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    Copy token
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Verifying */}
          {step === 3 && checking && (
            <div className="px-[26px] pt-[52px] pb-[44px] flex flex-col items-center gap-[22px]">
              <div className="w-[52px] h-[52px] rounded-full border-[3px] border-[var(--border)] border-t-[var(--primary)] animate-spin flex-none" />
              <div className="text-center">
                <div className="font-heading font-bold text-[18px] tracking-tight mb-[6px]">Verifying connection…</div>
                <div className="text-[13px] text-[var(--muted-foreground)]">Waiting for heartbeat from {siteUrl}</div>
              </div>
              <div className="w-full max-w-[400px] border border-[var(--border)]">
                <div className="flex items-center gap-[11px] px-[16px] py-[13px] border-b border-[var(--border)]">
                  <span className="w-[8px] h-[8px] flex-none rounded-full bg-[var(--primary)] animate-pulse" />
                  <span className="text-[13px] flex-1">Agent heartbeat</span>
                  <span className="text-[12px] text-[var(--muted-foreground)]">checking…</span>
                </div>
                <div className="flex items-center gap-[11px] px-[16px] py-[13px] border-b border-[var(--border)]">
                  <span className="w-[8px] h-[8px] flex-none rounded-full border-[1.5px] border-[var(--border)]" />
                  <span className="text-[13px] flex-1 text-[var(--muted-foreground)]">Sync core &amp; plugin inventory</span>
                  <span className="text-[12px] text-[var(--muted-foreground)]">queued</span>
                </div>
                <div className="flex items-center gap-[11px] px-[16px] py-[13px]">
                  <span className="w-[8px] h-[8px] flex-none rounded-full border-[1.5px] border-[var(--border)]" />
                  <span className="text-[13px] flex-1 text-[var(--muted-foreground)]">Configure uptime monitoring</span>
                  <span className="text-[12px] text-[var(--muted-foreground)]">queued</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Verified */}
          {step === 3 && verified && (
            <div className="px-[26px] pt-[24px] pb-[28px] flex flex-col gap-[20px]">
              <div className="flex items-center gap-[14px] px-[18px] py-[16px] border border-[var(--success)]">
                <span className="w-[34px] h-[34px] flex-none rounded-full bg-[var(--success)] text-[var(--success-foreground)] flex items-center justify-center">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                <div>
                  <div className="font-bold text-[14px]">Connected successfully</div>
                  <div className="text-[12.5px] text-[var(--muted-foreground)] mt-[2px]">{siteUrl} is now managed by WP Control Center</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-[1px] border border-[var(--border)] bg-[var(--border)]">
                {[
                  { label: "Site name", value: "Example Blog" },
                  { label: "WordPress", value: "6.7.2" },
                  { label: "PHP", value: "8.2.18" },
                  { label: "Active theme", value: "Astra Child" },
                ].map((item) => (
                  <div key={item.label} className="bg-[var(--card)] px-[16px] py-[13px]">
                    <div className="text-[11.5px] text-[var(--muted-foreground)] font-medium mb-[4px] uppercase tracking-[0.06em]">{item.label}</div>
                    <div className="text-[13.5px] font-semibold">{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="border border-[var(--border)]">
                <div className="px-[16px] py-[12px] border-b border-[var(--border)] text-[12.5px] font-semibold">Sync summary</div>
                {["Agent heartbeat confirmed", "Core indexed — WordPress 6.7.2", "14 plugins scanned & indexed", "3 themes scanned", "Uptime monitoring active"].map((msg, i) => (
                  <div key={i} className="flex items-center gap-[10px] px-[16px] py-[11px] border-b border-[var(--border)] last:border-0 text-[13px]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--success)] flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-[26px] py-[16px] border-t border-[var(--border)]">
            <button
              onClick={goBack}
              disabled={step === 1}
              className={`inline-flex items-center gap-[7px] h-[38px] px-[16px] border border-[var(--border)] font-semibold text-[13px] ${
                step === 1
                  ? "bg-[var(--background)] text-[var(--muted-foreground)] cursor-not-allowed"
                  : "bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--accent)]"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
              Back
            </button>

            <button
              onClick={goNext}
              disabled={step === 3 && checking}
              className={`inline-flex items-center gap-[7px] h-[38px] px-[18px] font-semibold text-[13px] ${
                step === 3 && checking
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] opacity-70 cursor-not-allowed"
                  : step === 3 && verified
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] cursor-pointer hover:opacity-90"
                  : "bg-[var(--primary)] text-[var(--primary-foreground)] cursor-pointer hover:opacity-90"
              }`}
            >
              {step === 1 && "Continue"}
              {step === 2 && "Verify connection"}
              {step === 3 && checking && (
                <><div className="w-[13px] h-[13px] rounded-full border-[2px] border-[var(--primary-foreground)] border-t-transparent animate-spin" /> Syncing…</>
              )}
              {step === 3 && verified && <>View site <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></>}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
