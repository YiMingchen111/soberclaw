import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import Navbar from "@/components/ui/Navbar";

export const metadata: Metadata = {
  title: "SoberClaw - AI 视频切片系统",
  description: "使用 AI 自动识别精彩内容，批量生成短视频切片，支持多样式字幕和配音",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Navbar />
        <main className="min-h-screen pt-16">
          {children}
        </main>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#16162e",
              color: "#f0f0ff",
              border: "1px solid #2a2a4a",
            },
          }}
        />
      </body>
    </html>
  );
}
