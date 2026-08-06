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
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="h-screen overflow-hidden">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("sticky-notes.theme");var th=t||(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.dataset.theme=th}catch(e){}`,
          }}
        />
        <ContextMenuProvider>{children}</ContextMenuProvider>
      </body>
    </html>
  );
}
