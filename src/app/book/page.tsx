"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, ArrowRight } from "lucide-react";
import { Card, PageHeader, SkeletonCard, EmptyState, Badge, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui";
import { bizFetch } from "@/lib/client-fetch";

interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number;
  category: string | null;
}

export default function BookingPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bizFetch("/api/services")
      .then((r) => r.json())
      .then((d) => {
        setServices(d.services ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <div className="skeleton h-8 w-48 mb-2" />
          <div className="skeleton h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  const categories = Array.from(new Set(services.map((s) => s.category || "General")));

  if (services.length === 0) {
    return (
      <EmptyState
        title="No Services Available"
        description="Check back later for available services."
      />
    );
  }

  return (
    <FadeIn>
      <PageHeader title="Our Services" description="Select a service to book an appointment" />

      {categories.map((cat) => (
        <div key={cat} className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-4">
            {cat}
          </h2>
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services
              .filter((s) => (s.category || "General") === cat)
              .map((s) => (
                <StaggerItem key={s.id}>
                  <Link href={`/book/${s.id}`} className="group block h-full">
                    <Card hover className="h-full flex flex-col justify-between">
                      <div>
                        <h3 className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent-text)] transition-colors">
                          {s.name}
                        </h3>
                        {s.description && (
                          <p className="text-sm text-[var(--color-text-tertiary)] mt-1 line-clamp-2">
                            {s.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--glass-border)]">
                        <div className="flex items-center gap-3">
                          <Badge variant="accent">
                            <Clock className="w-3 h-3 mr-1" />
                            {s.durationMin} min
                          </Badge>
                          <span className="font-semibold text-[var(--color-accent-text)]">
                            ${(s.priceCents / 100).toFixed(2)}
                          </span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[var(--color-text-quaternary)] group-hover:text-[var(--color-accent-text)] group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Card>
                  </Link>
                </StaggerItem>
              ))}
          </StaggerContainer>
        </div>
      ))}
    </FadeIn>
  );
}
