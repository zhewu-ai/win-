import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        page: {
          bg: "rgb(var(--page-bg-rgb) / <alpha-value>)",
        },
        sidebar: {
          bg: "rgb(var(--sidebar-bg-rgb) / <alpha-value>)",
        },
        toolbar: {
          bg: "rgb(var(--toolbar-bg-rgb) / <alpha-value>)",
        },
        panel: {
          bg: "rgb(var(--panel-bg-rgb) / <alpha-value>)",
        },
        border: {
          light: "rgb(var(--border-light-rgb) / <alpha-value>)",
          soft: "var(--border-soft)",
        },
        ink: {
          DEFAULT: "rgb(var(--ink-rgb) / <alpha-value>)",
          secondary: "rgb(var(--ink-secondary-rgb) / <alpha-value>)",
          muted: "rgb(var(--ink-muted-rgb) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "rgb(var(--primary-rgb) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "rgb(var(--danger-rgb) / <alpha-value>)",
        },
        success: {
          DEFAULT: "rgb(var(--success-rgb) / <alpha-value>)",
        },
        selection: {
          yellow: "rgb(var(--selection-yellow-rgb) / <alpha-value>)",
        },
        sel: {
          yellow: "#B08A20",
          blue: "#3A6DB0",
          green: "#35884F",
          pink: "#8A4A63",
          gray: "#6B6663",
        },
        tint: {
          yellow: "#4A3D20",
          blue: "#28384E",
          green: "#274034",
          pink: "#46303A",
          gray: "#383432",
        },
        accent: {
          yellow: "#E3C24A",
          blue: "#6FA3E8",
          green: "#52D67A",
          pink: "#F27BA5",
          gray: "#9E9A97",
        },
        surface: {
          hover: "var(--surface-hover)",
          active: "var(--surface-active)",
          strong: "var(--surface-strong)",
          focus: "var(--surface-focus)",
        },
        ring: {
          selected: "var(--ring-selected)",
        },
        search: {
          bg: "var(--search-bg)",
        },
      },
      borderRadius: {
        card: "10px",
        btn: "8px",
        input: "10px",
        thumb: "10px",
        modal: "12px",
      },
      fontSize: {
        "list-section": ["12px", { lineHeight: "1.3", fontWeight: "600" }],
        "list-title": ["14px", { lineHeight: "1.4", fontWeight: "600" }],
        "list-summary": ["13px", { lineHeight: "1.45", fontWeight: "400" }],
        "list-meta": ["12px", { lineHeight: "1.4", fontWeight: "400" }],
        "edit-title": ["clamp(20px, 2.2vw, 22px)", { lineHeight: "1.3", fontWeight: "700" }],
        "login-title": ["30px", { lineHeight: "1.22", fontWeight: "750" }],
        "edit-body": ["17px", { lineHeight: "1.65", fontWeight: "400" }],
        toolbar: ["13px", { lineHeight: "1.4", fontWeight: "500" }],
      },
      maxWidth: {
        paper: "760px",
      },
      spacing: {
        "icon-btn": "36px",
      },
    },
  },
  plugins: [],
};
export default config;
