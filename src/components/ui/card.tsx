"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  heavy?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddings = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function GlassPanel({ children, className = "", heavy, padding = "md" }: GlassPanelProps) {
  return (
    <div
      className={`
        ${heavy ? "glass-panel-heavy" : "glass-panel"}
        rounded-[var(--radius-xl)]
        ${paddings[padding]}
        ${className}
      `.trim()}
    >
      {children}
    </div>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({ children, className = "", hover, onClick, padding = "md" }: CardProps) {
  const Comp = onClick ? motion.button : motion.div;
  return (
    <Comp
      onClick={onClick}
      whileHover={hover ? { y: -2, boxShadow: "var(--shadow-lg)" } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
      transition={{ duration: 0.2 }}
      className={`
        surface rounded-[var(--radius-xl)] shadow-sm
        ${hover ? "cursor-pointer transition-shadow duration-normal" : ""}
        ${paddings[padding]}
        ${onClick ? "text-left w-full" : ""}
        ${className}
      `.trim()}
    >
      {children}
    </Comp>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
