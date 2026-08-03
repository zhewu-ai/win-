import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "全平台便签",
  description: "全平台便签 Web MVP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="h-screen overflow-hidden">{children}</body>
    </html>
  );
}
