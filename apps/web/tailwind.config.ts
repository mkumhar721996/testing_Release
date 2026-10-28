import type { Config } from "tailwindcss";

const token = (name: string) => `var(--${name})`;
const scale = (prefix: string, keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, token(`${prefix}-${k}`)]));

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("color-bg"),
        "bg-subtle": token("color-bg-subtle"),
        "bg-inset": token("color-bg-inset"),
        fg: token("color-fg"),
        "fg-muted": token("color-fg-muted"),
        "fg-inverse": token("color-fg-inverse"),
        primary: token("color-primary"),
        "primary-hover": token("color-primary-hover"),
        "primary-subtle": token("color-primary-subtle"),
        border: token("color-border"),
        "border-strong": token("color-border-strong"),
        success: token("color-success"),
        "success-subtle": token("color-success-subtle"),
        warning: token("color-warning"),
        "warning-subtle": token("color-warning-subtle"),
        danger: token("color-danger"),
        "danger-subtle": token("color-danger-subtle"),
        overlay: token("color-overlay"),
      },
      spacing: Object.fromEntries(
        [1, 2, 3, 4, 5, 6].map((n) => [`s${n}`, token(`space-${n}`)]),
      ),
      borderRadius: scale("radius", ["sm", "md", "lg", "full"]),
      fontSize: scale("font-size", ["xs", "sm", "md", "lg", "xl"]),
      fontFamily: { sans: [token("font-family-sans")], mono: [token("font-family-mono")] },
      fontWeight: { medium: token("font-weight-medium"), semibold: token("font-weight-semibold") },
      boxShadow: scale("shadow", ["sm", "md"]),
    },
  },
  plugins: [],
} satisfies Config;
