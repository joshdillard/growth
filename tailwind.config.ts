import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./remotion/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#7C3AED",
          dark: "#5B21B6",
          accent: "#F59E0B",
        },
      },
    },
  },
  plugins: [],
};

export default config;
