/** @type {import('tailwindcss').Config} */

/* Madhura design system: navy / gold / white.
   The legacy `blue`, `cyan`, `indigo`, `purple` scales are remapped to brand gold
   and `slate` to a navy-tinted neutral, so every page inherits the system. */
const gold = {
  50: "hsl(var(--gold-50))",
  100: "hsl(var(--gold-100))",
  200: "hsl(var(--gold-200))",
  300: "hsl(var(--gold-300))",
  400: "hsl(var(--gold-400))",
  500: "hsl(var(--gold-500))",
  600: "hsl(var(--gold-600))",
  700: "hsl(var(--gold-700))",
  800: "hsl(var(--gold-800))",
  900: "hsl(var(--gold-900))",
  950: "hsl(var(--gold-950))",
};

const navy = {
  50: "hsl(var(--navy-50))",
  100: "hsl(var(--navy-100))",
  200: "hsl(var(--navy-200))",
  300: "hsl(var(--navy-300))",
  400: "hsl(var(--navy-400))",
  500: "hsl(var(--navy-500))",
  600: "hsl(var(--navy-600))",
  700: "hsl(var(--navy-700))",
  800: "hsl(var(--navy-800))",
  900: "hsl(var(--navy-900))",
  950: "hsl(var(--navy-950))",
};

/* Real product blue. `blue` stays remapped to gold, so surfaces that must read
   as blue — primary CTAs, section eyebrows, the integration cards — reach for
   `azure-*` instead. Nothing else in the site uses this scale yet. */
const azure = {
  50: "#eff6ff",
  100: "#dbeafe",
  200: "#bfdbfe",
  300: "#93c5fd",
  400: "#60a5fa",
  500: "#3b82f6",
  600: "#2563eb",
  700: "#1d4ed8",
  800: "#1e40af",
  900: "#1e3a8a",
  950: "#172554",
};

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        azure,
        blue: gold,
        cyan: gold,
        indigo: gold,
        purple: gold,
        slate: navy,
        gray: navy,
        brand: {
          navy: "hsl(var(--brand-navy))",
          deep: "hsl(var(--brand-deep))",
          mid: "hsl(var(--brand-mid))",
          gold: "hsl(var(--brand-gold))",
          "gold-soft": "hsl(var(--brand-gold-soft))",
          soft: "hsl(var(--bg-soft))",
          ink: "hsl(var(--ink))",
          muted: "hsl(var(--body-muted))",
          line: "hsl(var(--border-soft))",
        },
      },
      fontFamily: {
        sans: ["Poppins", "Outfit", "Arial", "sans-serif"],
        display: ["Outfit", "Poppins", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
        compact: "8px",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        hover: "var(--shadow-card-hover)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96) translateY(8px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "float-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "bridge-flow": {
          "0%": { transform: "translateX(-110%)" },
          "100%": { transform: "translateX(210%)" },
        },
        "shine-sweep": {
          "0%": { transform: "translateX(-120%) skewX(-18deg)" },
          "100%": { transform: "translateX(320%) skewX(-18deg)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "scale-in": "scale-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        float: "float-subtle 3.5s ease-in-out infinite",
        "pulse-slow": "pulse-slow 2s ease-in-out infinite",
        "bridge-flow": "bridge-flow 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        "shine-sweep": "shine-sweep 2.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
