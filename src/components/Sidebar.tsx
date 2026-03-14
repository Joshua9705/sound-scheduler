"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { 
  LayoutDashboard, 
  Users, 
  CalendarPlus, 
  CalendarDays,
  Menu,
  X,
  Headphones
} from "lucide-react";

const menuItems = [
  { name: "儀表板", href: "/", icon: LayoutDashboard },
  { name: "人員管理", href: "/members", icon: Users },
  { name: "產出班表", href: "/generate", icon: CalendarPlus },
  { name: "查看班表", href: "/schedule", icon: CalendarDays },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button 
        onClick={() => setOpen(true)} 
        className="fixed top-4 left-4 z-50 p-2.5 bg-zinc-900 border border-zinc-700 rounded-xl md:hidden shadow-lg"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Overlay */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm" 
          onClick={() => setOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed left-0 top-0 h-screen w-72 bg-zinc-950 border-r border-zinc-800/50 p-5 z-50
        transition-transform duration-300 ease-in-out
        ${open ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0
      `}>
        {/* Close button (mobile) */}
        <button 
          onClick={() => setOpen(false)} 
          className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-white md:hidden"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-10 px-3 py-5 border-b border-zinc-800/50">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-xl">
              <Headphones className="w-7 h-7 text-blue-400" />
            </div>
            音控排班
          </h1>
          <p className="text-xs text-zinc-600 mt-2 pl-1">Sound Team Scheduler</p>
        </div>
        
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-[15px] ${
                  isActive 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20 font-semibold" 
                    : "text-zinc-400 hover:bg-zinc-800/70 hover:text-white"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="absolute bottom-5 left-5 right-5 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/30">
          <p className="text-[11px] text-zinc-600 text-center">
            © 2026 Sound Team Scheduler
          </p>
        </div>
      </aside>
    </>
  );
}
