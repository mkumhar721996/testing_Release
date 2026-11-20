import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        "bg-subtle": "var(--color-bg-subtle)",
        "bg-inset": "var(--color-bg-inset)",
        fg: "var(--color-fg)",
        "fg-muted": "var(--color-fg-muted)",
        "fg-inverse": "var(--color-fg-inverse)",
        primary: "var(--color-primary)",
        "primary-hover": "var(--color-primary-hover)",
        "primary-subtle": "var(--color-primary-subtle)",
        border: "var(--color-border)",
        "border-strong": "var(--color-border-strong)",
        danger: "var(--color-danger)",
        "danger-subtle": "var(--color-danger-subtle)",
        warning: "var(--color-warning)",
        "warning-subtle": "var(--color-warning-subtle)",
      },
      spacing: {
        t1: "var(--space-1)",
        t2: "var(--space-2)",
        t3: "var(--space-3)",
        t4: "var(--space-4)",
        t5: "var(--space-5)",
        t6: "var(--space-6)",
      },
      borderRadius: {
        "t-sm": "var(--radius-sm)",
        "t-md": "var(--radius-md)",
        "t-lg": "var(--radius-lg)",
      },
      fontSize: {
        "t-xs": "var(--font-size-xs)",
        "t-sm": "var(--font-size-sm)",
        "t-md": "var(--font-size-md)",
        "t-lg": "var(--font-size-lg)",
        "t-xl": "var(--font-size-xl)",
      },
      boxShadow: { "t-md": "var(--shadow-md)" },
    },
  },
  plugins: [],
} satisfies Config;
