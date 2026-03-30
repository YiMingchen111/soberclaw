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
        accent:  "#FB923C",
        "accent-2": "#F97316",
        stone: {
          850: "#1C1917",
          900: "#12100F",
        },
      },
    },
  },
  plugins: [],
};

export default config;
