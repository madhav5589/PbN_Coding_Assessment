import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['SF Mono', 'SFMono-Regular', 'ui-monospace', 'Cascadia Code', 'Menlo', 'monospace'],
      },
      colors: {
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          light: 'var(--color-accent-light)',
          subtle: 'var(--color-accent-subtle)',
          text: 'var(--color-accent-text)',
        },
        surface: {
          DEFAULT: 'rgb(var(--color-surface))',
          elevated: 'rgb(var(--color-surface-elevated))',
        },
        app: {
          bg: 'rgb(var(--color-bg-secondary))',
          primary: 'rgb(var(--color-bg-primary))',
          tertiary: 'rgb(var(--color-bg-tertiary))',
        },
        txt: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          quaternary: 'var(--color-text-quaternary)',
          inverse: 'var(--color-text-inverse)',
        },
        semantic: {
          success: 'var(--color-success)',
          'success-bg': 'var(--color-success-bg)',
          'success-text': 'var(--color-success-text)',
          warning: 'var(--color-warning)',
          'warning-bg': 'var(--color-warning-bg)',
          'warning-text': 'var(--color-warning-text)',
          error: 'var(--color-error)',
          'error-bg': 'var(--color-error-bg)',
          'error-text': 'var(--color-error-text)',
          info: 'var(--color-info)',
          'info-bg': 'var(--color-info-bg)',
          'info-text': 'var(--color-info-text)',
        },
      },
      borderColor: {
        DEFAULT: 'var(--color-border)',
        strong: 'var(--color-border-strong)',
        focus: 'var(--color-border-focus)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
      },
      transitionTimingFunction: {
        'ease-out-custom': 'var(--ease-out)',
        spring: 'var(--ease-spring)',
      },
    },
  },
  plugins: [],
};

export default config;
