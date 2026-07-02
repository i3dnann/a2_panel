import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        a2: {
          green: "#b7fe1a",
          bg: "#050604",
          panel: "#0b0e0b",
          line: "rgba(183,254,26,0.16)"
        }
      },
      boxShadow: {
        glow: "0 0 28px rgba(183,254,26,0.18)",
        panel: "0 24px 80px rgba(0,0,0,0.38)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;
