import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        paper: "#fbfaf7",
        line: "#ded8cf",
        brand: "#1d6f63",
        accent: "#b94f3a",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 32, 42, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
