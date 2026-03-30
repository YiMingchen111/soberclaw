import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import Navbar from "@/components/ui/Navbar";

export const metadata: Metadata = {
  title: "SoberClaw · AI 视频切片",
  description: "豆包 AI 自动识别精彩内容，批量生成短视频切片，支持多样式字幕和配音",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Navbar />
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: "var(--bg-2)",
              color: "var(--text-1)",
              border: "1px solid var(--border)",
              fontSize: "13px",
              borderRadius: "10px",
            },
            success: { iconTheme: { primary: "var(--accent)", secondary: "#111" } },
          }}
        />
      </body>
    </html>
  );
}
