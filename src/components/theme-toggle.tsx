"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ui";
import { motion } from "framer-motion";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className="
        relative w-10 h-10 rounded-[var(--radius-lg)]
        glass-panel flex items-center justify-center
        text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
        transition-colors duration-normal
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]
      "
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      <motion.div
        initial={false}
        animate={{ rotate: theme === "dark" ? 180 : 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {theme === "light" ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5" />}
      </motion.div>
    </button>
  );
}
