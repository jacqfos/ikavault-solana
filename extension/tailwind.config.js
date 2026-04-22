/** @type {import('tailwindcss').Config} */
export default {
  content: ["./popup.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // OLED-friendly dark theme
        surface: {
          DEFAULT: "#000000",
          1: "#0a0a0a",
          2: "#111111",
          3: "#1a1a1a",
          4: "#222222",
        },
        accent: {
          DEFAULT: "#9945FF",  // Solana purple
          hover: "#B06EFF",
          dim: "#9945FF33",
        },
        success: "#14F195",   // Solana green
        warning: "#FFB800",
        danger: "#FF4545",
        muted: "#666666",
        border: "#222222",
      },
    },
  },
  plugins: [],
};
