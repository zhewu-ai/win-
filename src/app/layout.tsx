import type { Metadata } from "next";
import "./globals.css";
import ContextMenuProvider from "@/components/ContextMenu";

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
      <body className="h-screen overflow-hidden">
        <ContextMenuProvider>{children}</ContextMenuProvider>
      </body>
    </html>
  );
}
