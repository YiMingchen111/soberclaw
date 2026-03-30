"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scissors, Settings, Upload, Cpu } from "lucide-react";

const NAV = [
  { href: "/",            label: "上传",    icon: Upload },
  { href: "/slices",      label: "切片管理", icon: Scissors },
  { href: "/preferences", label: "创作偏好", icon: Settings },
];

export default function Navbar() {
  const path = usePathname();

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 h-14 flex items-center px-5"
      style={{
        background: "rgba(28,25,23,0.92)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mr-8 no-underline">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "var(--accent)" }}
        >
          <Cpu size={15} className="text-black" />
        </div>
        <span className="font-semibold text-sm tracking-wide" style={{ color: "var(--text-1)" }}>
          SoberClaw
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ background: "var(--accent-dim)", color: "var(--accent)", fontSize: "11px" }}
        >
          AI 切片
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex items-center gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all no-underline"
              style={{
                color:      active ? "var(--accent)" : "var(--text-2)",
                background: active ? "var(--accent-dim)" : "transparent",
                fontWeight: active ? 500 : 400,
              }}
            >
              <Icon size={14} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right: AI badge */}
      <div className="ml-auto flex items-center gap-2">
        <div
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
          style={{ background: "var(--bg-2)", color: "var(--text-2)", border: "1px solid var(--border)" }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--green)" }}
          />
          豆包 AI
        </div>
      </div>
    </header>
  );
}
