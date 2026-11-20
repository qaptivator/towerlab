import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{vue,ts}"],
  theme: {
    extend: {
      colors: {
        canvas: "#09090B",
        subtle: "#121215",
        raised: "#18181B",
        overlay: "#222227",
        container: "#1f1f22",
        "container-high": "#2a2a2d",
        "border-subtle": "#27272A",
        "border-prominent": "#3F3F46",
        ink: "#F4F4F5",
        muted: "#A1A1AA",
        dim: "#71717A",
        mint: "#2DD4BF",
        "mint-deep": "#00574d",
        danger: "#ffb4ab",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Geist", "Inter", "ui-sans-serif", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        mint: "0 0 20px rgba(45, 212, 191, 0.2)",
      },
    },
  },
} satisfies Config;
