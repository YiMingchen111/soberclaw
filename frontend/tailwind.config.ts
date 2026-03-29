import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#fdf2ff",
          100: "#fae5ff",
          200: "#f4ceff",
          300: "#eba5ff",
          400: "#df6dff",
          500: "#cc3ff7",
          600: "#b01ed4",
          700: "#9218ac",
          800: "#79198c",
          900: "#641a72",
          950: "#43044f",
        },
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #cc3ff7 0%, #6366f1 100%)",
        "gradient-dark":  "linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%)",
      },
      animation: {
        "fade-in":    "fadeIn 0.3s ease-in-out",
        "slide-up":   "slideUp 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)",    opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
