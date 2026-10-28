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
        "primary-subtle": "var(--color-primary-subtle)",
        border: "var(--color-border)",
        "border-strong": "var(--color-border-strong)",
      },
      spacing: {
        "space-1": "var(--space-1)",
        "space-2": "var(--space-2)",
        "space-3": "var(--space-3)",
        "space-4": "var(--space-4)",
        "space-5": "var(--space-5)",
        "space-6": "var(--space-6)",
      },
      borderRadius: {
        "radius-md": "var(--radius-md)",
        "radius-lg": "var(--radius-lg)",
      },
      fontSize: {
        "token-xs": "var(--font-size-xs)",
        "token-sm": "var(--font-size-sm)",
        "token-md": "var(--font-size-md)",
        "token-lg": "var(--font-size-lg)",
        "token-xl": "var(--font-size-xl)",
      },
      fontFamily: { ui: "var(--font-family-sans)" },
      boxShadow: { "token-md": "var(--shadow-md)" },
    },
  },
  plugins: [],
} satisfies Config;
