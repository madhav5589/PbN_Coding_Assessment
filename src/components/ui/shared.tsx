"use client";

import { ReactNode } from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "./button";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info" | "accent";
  size?: "sm" | "md";
  className?: string;
}

const badgeVariants = {
  default: "bg-[rgb(var(--color-bg-tertiary))] text-[var(--color-text-secondary)]",
  success: "bg-[var(--color-success-bg)] text-[var(--color-success-text)]",
  warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]",
  error: "bg-[var(--color-error-bg)] text-[var(--color-error-text)]",
  info: "bg-[var(--color-info-bg)] text-[var(--color-info-text)]",
  accent: "bg-[var(--color-accent-light)] text-[var(--color-accent-text)]",
};

export function Badge({ children, variant = "default", size = "sm", className = "" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-[var(--radius-full)]
        ${size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}
        ${badgeVariants[variant]}
        ${className}
      `.trim()}
    >
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
    BOOKED: { variant: "info", label: "Booked" },
    CANCELLED: { variant: "error", label: "Cancelled" },
    COMPLETED: { variant: "success", label: "Completed" },
    NO_SHOW: { variant: "warning", label: "No Show" },
  };
  const config = map[status] || { variant: "default" as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function SkeletonCard() {
  return (
    <div className="surface rounded-[var(--radius-xl)] p-6 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="surface rounded-[var(--radius-xl)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-4 py-3 border-b border-[var(--color-border)] last:border-0">
          <div className="flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-[var(--radius-xl)] bg-[var(--color-accent-subtle)] flex items-center justify-center mb-4">
        {icon || <Inbox className="w-6 h-6 text-[var(--color-accent-text)]" />}
      </div>
      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">{title}</h3>
      {description && <p className="text-sm text-[var(--color-text-tertiary)] max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({ title = "Something went wrong", description, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-[var(--radius-xl)] bg-[var(--color-error-bg)] flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6 text-[var(--color-error-text)]" />
      </div>
      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">{title}</h3>
      {description && <p className="text-sm text-[var(--color-text-tertiary)] max-w-sm">{description}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} icon={<RefreshCw className="w-3.5 h-3.5" />} className="mt-4">
          Try Again
        </Button>
      )}
    </div>
  );
}

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <span className="relative group inline-flex">
      {children}
      <span
        role="tooltip"
        className="
          absolute bottom-full left-1/2 -translate-x-1/2 mb-2
          px-2.5 py-1.5 text-xs font-medium
          bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]
          rounded-[var(--radius-md)] shadow-lg
          opacity-0 group-hover:opacity-100
          transition-opacity duration-fast
          pointer-events-none whitespace-nowrap z-50
        "
      >
        {content}
      </span>
    </span>
  );
}

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Avatar({ name, size = "md", className = "" }: AvatarProps) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base" };
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`
        ${sizes[size]}
        rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent-text)]
        flex items-center justify-center font-semibold
        ${className}
      `.trim()}
      aria-label={name}
    >
      {initials}
    </div>
  );
}

interface TabsProps {
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className = "" }: TabsProps) {
  return (
    <div className={`flex gap-1 p-1 rounded-[var(--radius-lg)] bg-[rgb(var(--color-bg-tertiary))] ${className}`} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            px-4 py-2 text-sm font-medium rounded-[var(--radius-md)]
            transition-all duration-normal ease-out-custom
            ${activeTab === tab.id
              ? "bg-[rgb(var(--color-surface))] text-[var(--color-text-primary)] shadow-sm"
              : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }
          `}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-xs opacity-60">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
