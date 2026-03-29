"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scissors, Settings, Upload, Film } from "lucide-react";

const links = [
  { href: "/",            label: "上传视频",  icon: Upload },
  { href: "/slices",      label: "切片管理",  icon: Scissors },
  { href: "/preferences", label: "创作偏好",  icon: Settings },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#2a2a4a]"
      style={{ background: "rgba(10,10,26,0.9)", backdropFilter: "blur(12px)" }}>
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #cc3ff7 0%, #6366f1 100%)" }}>
            <Film size={18} className="text-white" />
          </div>
          <span className="font-bold text-lg gradient-text">SoberClaw</span>
          <span className="text-xs text-[#9090b8] hidden sm:block">AI视频切片</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? "text-white"
                    : "text-[#9090b8] hover:text-white hover:bg-white/5"
                  }`}
                style={active ? { background: "rgba(204,63,247,0.15)", color: "#cc3ff7" } : {}}
              >
                <Icon size={16} />
                <span className="hidden sm:block">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
