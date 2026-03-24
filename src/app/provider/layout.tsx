"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scissors, LayoutDashboard, Wrench, Users, CalendarClock, CalendarDays, Clock } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { TenantGuard } from "@/components/tenant-guard";

const navItems = [
  { href: "/provider", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/provider/services", label: "Services", icon: Wrench },
  { href: "/provider/staff", label: "Staff", icon: Users },
  { href: "/provider/schedule", label: "Schedule", icon: Clock },
  { href: "/provider/appointments", label: "Appointments", icon: CalendarClock },
  { href: "/provider/calendar", label: "Calendar", icon: CalendarDays },
];

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 glass-panel-heavy border-b border-[var(--glass-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/provider" className="flex items-center gap-2.5 group shrink-0">
              <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-accent-light)] flex items-center justify-center">
                <Scissors className="w-4 h-4 text-[var(--color-accent-text)]" />
              </div>
              <span className="text-lg font-semibold text-[var(--color-text-primary)] tracking-tight">
                StyleHub
              </span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-quaternary)] hidden sm:block">
                Admin
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1" role="navigation" aria-label="Provider navigation">
              {navItems.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium
                      transition-all duration-fast
                      ${active
                        ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]"
                        : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[rgb(var(--color-bg-tertiary))]"
                      }
                    `}
                    aria-current={active ? "page" : undefined}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <ThemeToggle />
        </div>

        {/* Mobile nav */}
        <div className="md:hidden border-t border-[var(--color-border)] overflow-x-auto">
          <nav className="flex px-4 gap-1 py-2" role="navigation" aria-label="Provider mobile navigation">
            {navItems.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium whitespace-nowrap
                    ${active
                      ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]"
                      : "text-[var(--color-text-tertiary)]"
                    }
                  `}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <TenantGuard>{children}</TenantGuard>
      </main>
    </div>
  );
}
