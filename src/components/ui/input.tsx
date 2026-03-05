"use client";

import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";

const baseInput =
  "w-full bg-rgb(var(--color-surface)) text-[var(--color-text-primary)] " +
  "border border-[var(--color-border)] rounded-[var(--radius-md)] " +
  "placeholder:text-[var(--color-text-quaternary)] " +
  "focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:border-transparent " +
  "transition-all duration-normal ease-out-custom " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-[var(--color-text-secondary)]">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              ${baseInput}
              ${icon ? "pl-10" : "px-3"} py-2.5 text-sm
              ${error ? "border-[var(--color-error)] focus:ring-[var(--color-error)]" : ""}
              ${className}
            `.trim()}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-[var(--color-error-text)]" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-[var(--color-text-tertiary)]">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-[var(--color-text-secondary)]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`
            ${baseInput}
            px-3 py-2.5 text-sm min-h-[80px] resize-y
            ${error ? "border-[var(--color-error)] focus:ring-[var(--color-error)]" : ""}
            ${className}
          `.trim()}
          aria-invalid={!!error}
          {...props}
        />
        {error && <p className="text-xs text-[var(--color-error-text)]" role="alert">{error}</p>}
        {hint && !error && <p className="text-xs text-[var(--color-text-tertiary)]">{hint}</p>}
      </div>
    );
  }
);
TextArea.displayName = "TextArea";

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-[var(--color-text-secondary)]">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={`
            ${baseInput}
            px-3 py-2.5 text-sm appearance-none cursor-pointer
            bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22%236e6e73%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22m4.427%205.427%203.396%203.396a.25.25%200%200%200%20.354%200l3.396-3.396A.25.25%200%200%200%2011.396%205H4.604a.25.25%200%200%200-.177.427z%22%2F%3E%3C%2Fsvg%3E')]
            bg-no-repeat bg-[right_0.75rem_center] pr-8
            ${error ? "border-[var(--color-error)] focus:ring-[var(--color-error)]" : ""}
            ${className}
          `.trim()}
          aria-invalid={!!error}
          {...(props as any)}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {error && <p className="text-xs text-[var(--color-error-text)]" role="alert">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

export function Checkbox({ label, className = "", id, ...props }: CheckboxProps) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, "-");
  return (
    <label
      htmlFor={inputId}
      className={`flex items-center gap-3 cursor-pointer group px-3 py-2.5 rounded-[var(--radius-lg)] transition-colors hover:bg-[var(--color-accent-subtle)] ${className}`}
    >
      <span className="relative flex items-center justify-center w-5 h-5 shrink-0">
        <input
          type="checkbox"
          id={inputId}
          className="peer sr-only"
          {...props}
        />
        <span className="w-5 h-5 rounded-[var(--radius-sm)] border-2 border-[var(--color-border-strong)] bg-[rgb(var(--color-bg-primary))] transition-all peer-checked:bg-[var(--color-accent)] peer-checked:border-[var(--color-accent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent)] peer-focus-visible:ring-offset-2" />
        <svg
          className="absolute inset-0 m-auto w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="2 6 5 9 10 3" />
        </svg>
      </span>
      <span className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-text-primary)] transition-colors">
        {label}
      </span>
    </label>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export function Switch({ checked, onChange, label, disabled, id }: SwitchProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-") || "switch";
  return (
    <label htmlFor={inputId} className={`inline-flex items-center gap-2.5 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
      <button
        id={inputId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 shrink-0 items-center rounded-full
          transition-colors duration-normal ease-out-custom
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2
          ${checked ? "bg-[var(--color-accent)]" : "bg-[var(--color-text-quaternary)]"}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm
            transition-transform duration-normal ease-out-custom
            ${checked ? "translate-x-[22px]" : "translate-x-[2px]"}
          `}
        />
      </button>
      {label && <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>}
    </label>
  );
}
