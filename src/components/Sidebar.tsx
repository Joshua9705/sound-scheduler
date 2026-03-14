"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  CalendarPlus, 
  CalendarDays,
  Settings
} from "lucide-react";

const menuItems = [
  { name: "儀表板", href: "/", icon: LayoutDashboard },
  { name: "人員管理", href: "/members", icon: Users },
  { name: "產出班表", href: "/generate", icon: CalendarPlus },
  { name: "查看班表", href: "/schedule", icon: CalendarDays },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-zinc-900 border-r border-zinc-800 p-4">
      <div className="mb-8 px-2 py-4 border-b border-zinc-800">
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-500" />
          音控排班系統
        </h1>
      </div>
      <nav className="space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive 
                  ? "bg-blue-600 text-white" 
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="absolute bottom-4 left-4 right-4 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
        <p className="text-xs text-zinc-500 text-center">
          © 2026 Sound Team Scheduler
        </p>
      </div>
    </aside>
  );
}
