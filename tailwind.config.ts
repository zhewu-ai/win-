import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        page: {
          bg: "#191919",
        },
        sidebar: {
          bg: "#241E20",
        },
        toolbar: {
          bg: "#221C1E",
        },
        panel: {
          bg: "#1A1A1A",
        },
        border: {
          light: "#3B3335",
        },
        ink: {
          DEFAULT: "#F5F4F2",
          secondary: "#C9C4C0",
          muted: "#8F8986",
        },
        primary: {
          DEFAULT: "#B99A28",
        },
        danger: {
          DEFAULT: "#FF3B30",
        },
        success: {
          DEFAULT: "#34C759",
        },
        selection: {
          yellow: "#B08A20",
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
        search: {
          bg: "rgba(255,255,255,0.08)",
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
        "edit-title": ["30px", { lineHeight: "1.22", fontWeight: "750" }],
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
