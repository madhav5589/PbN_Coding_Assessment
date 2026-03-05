"use client";

import Link from "next/link";
import { Scissors, ArrowRight, Shield } from "lucide-react";
import { Button, FadeIn, GlassPanel } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-8 overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent-subtle)] via-transparent to-[rgb(var(--color-bg-secondary))]" />

      {/* Theme toggle */}
      <div className="absolute top-6 right-6 z-10">
        <ThemeToggle />
      </div>

      <FadeIn className="relative z-10 text-center max-w-2xl">
        <GlassPanel heavy padding="lg" className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-[var(--radius-2xl)] bg-[var(--color-accent-light)] flex items-center justify-center mb-6">
            <Scissors className="w-8 h-8 text-[var(--color-accent-text)]" />
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[var(--color-text-primary)] mb-3">
            StyleHub
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)] mb-8 max-w-md">
            Premium Hair Salon — Book your next appointment with ease
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link href="/book">
              <Button size="lg" icon={<ArrowRight className="w-5 h-5" />}>
                Book Appointment
              </Button>
            </Link>
            <Link href="/provider">
              <Button variant="secondary" size="lg" icon={<Shield className="w-5 h-5" />}>
                Provider Portal
              </Button>
            </Link>
          </div>
        </GlassPanel>
      </FadeIn>
    </main>
  );
}
