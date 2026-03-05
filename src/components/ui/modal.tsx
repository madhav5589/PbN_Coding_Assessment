"use client";

import { ReactNode, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { overlayVariants, modalVariants, drawerVariants } from "./motion";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const modalSizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, handleEsc]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 bg-[var(--overlay-bg)] backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal
            aria-label={title}
            className={`
              relative w-full ${modalSizes[size]}
              surface-elevated rounded-[var(--radius-2xl)]
              max-h-[85vh] flex flex-col overflow-hidden
            `}
          >
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-accent-subtle)] transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  side?: "right" | "left";
}

export function Drawer({ open, onClose, title, children, side = "right" }: DrawerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) {
      document.addEventListener("keydown", handler);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const variants = {
    hidden: { x: side === "right" ? "100%" : "-100%" },
    visible: { x: 0, transition: { duration: 0.26, ease: [0.25, 0.46, 0.45, 0.94] as const } },
    exit: { x: side === "right" ? "100%" : "-100%", transition: { duration: 0.2 } },
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 bg-[var(--overlay-bg)] backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`
              absolute top-0 bottom-0 ${side === "right" ? "right-0" : "left-0"}
              w-full max-w-md
              surface-elevated flex flex-col
            `}
            role="dialog"
            aria-modal
            aria-label={title}
          >
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
                <h2 className="text-lg font-semibold">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-accent-subtle)] transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
