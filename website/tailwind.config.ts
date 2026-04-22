import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#050507",
          900: "#0a0a0f",
          800: "#13131a",
          700: "#1c1c26",
          600: "#2a2a38",
        },
        mint: {
          DEFAULT: "#7cffcb",
          soft: "#9effd6",
          deep: "#1fe0a0",
        },
        violet: {
          DEFAULT: "#8b5cf6",
          soft: "#a78bfa",
          deep: "#6d28d9",
        },
        pink: {
          DEFAULT: "#ff6b9d",
          soft: "#ff92b5",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "ui-sans-serif", "system-ui"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
      animation: {
        "orb-spin": "orb-spin 18s linear infinite",
        "orb-spin-reverse": "orb-spin 22s linear infinite reverse",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "grain": "grain 8s steps(10) infinite",
      },
      keyframes: {
        "orb-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.5", filter: "blur(40px)" },
          "50%": { opacity: "0.9", filter: "blur(60px)" },
        },
        "grain": {
          "0%, 100%": { transform: "translate(0,0)" },
          "10%": { transform: "translate(-2%,-3%)" },
          "30%": { transform: "translate(3%,2%)" },
          "50%": { transform: "translate(-1%,4%)" },
          "70%": { transform: "translate(4%,-1%)" },
          "90%": { transform: "translate(-3%,3%)" },
        },
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(180deg, transparent, #050507 80%), url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><path d='M40 0H0v40' fill='none' stroke='%231c1c26' stroke-width='0.5'/></svg>\")",
      },
    },
  },
  plugins: [],
};

export default config;
