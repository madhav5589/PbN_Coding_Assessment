"use client";

import { useEffect, useState } from "react";
import { Building2, Terminal } from "lucide-react";
import { bizFetch } from "@/lib/client-fetch";

type Status = "checking" | "ok" | "not_found";

/**
 * Guards a page subtree against an invalid NEXT_PUBLIC_BUSINESS_ID.
 *
 * On mount it calls /api/tenant/check with the configured business ID header.
 * If the API returns 400 (TENANT_REQUIRED — business not in DB), children are
 * replaced with a clear, actionable error screen instead of a cryptic stack
 * trace. During the brief check the component renders nothing so child pages
 * never mount and never attempt their own broken API calls.
 *
 * Network errors (DB down, server not started) are treated as "ok" so the
 * individual pages can show their own loading / error states normally.
 */
export function TenantGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    bizFetch("/api/tenant/check")
      .then((res) => setStatus(res.ok ? "ok" : "not_found"))
      .catch(() => setStatus("ok"));
  }, []);

  if (status === "checking") return null;

  if (status === "not_found") {
    const bizId = process.env.NEXT_PUBLIC_BUSINESS_ID ?? "(not set)";
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-error-bg)] flex items-center justify-center mb-6">
          <Building2 className="w-8 h-8 text-[var(--color-error-text)]" />
        </div>

        {/* Heading */}
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
          Business Not Found
        </h2>
        <p className="text-sm text-[var(--color-text-tertiary)] max-w-md mb-6">
          The value set in{" "}
          <code className="font-mono text-xs bg-[rgb(var(--color-bg-tertiary))] border border-[var(--glass-border)] rounded px-1.5 py-0.5">
            NEXT_PUBLIC_BUSINESS_ID
          </code>{" "}
          does not match any business in the database.
        </p>

        {/* Current value + fix instructions */}
        <div className="w-full max-w-sm text-left surface rounded-xl border border-[var(--glass-border)] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--glass-border)] bg-[var(--glass-bg)]">
            <Terminal className="w-3.5 h-3.5 text-[var(--color-text-quaternary)]" />
            <span className="text-xs font-medium text-[var(--color-text-tertiary)]">.env</span>
          </div>
          <div className="px-4 py-3 font-mono text-xs space-y-1">
            <p className="text-[var(--color-text-quaternary)]"># Current (not found in DB):</p>
            <p className="text-[var(--color-error-text)] break-all">
              NEXT_PUBLIC_BUSINESS_ID=&quot;{bizId}&quot;
            </p>
            <p className="text-[var(--color-text-quaternary)] mt-2"># Find the correct ID:</p>
            <p className="text-[var(--color-text-secondary)]">
              SELECT id FROM businesses LIMIT 1;
            </p>
            <p className="text-[var(--color-text-quaternary)] mt-2"># Then restart the dev server.</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
