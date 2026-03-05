"use client";

import Link from "next/link";
import { Scissors } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {/* Subtle gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-[var(--color-accent-subtle)] via-transparent to-transparent pointer-events-none" />

      <header className="sticky top-0 z-40 glass-panel-heavy border-b border-[var(--glass-border)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <Link href="/book" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-accent-light)] flex items-center justify-center">
              <Scissors className="w-4 h-4 text-[var(--color-accent-text)]" />
            </div>
            <span className="text-lg font-semibold text-[var(--color-text-primary)] tracking-tight">
              StyleHub
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--color-text-tertiary)] hidden sm:block">Online Booking</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="relative max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
