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
  Headphones,
  ClipboardCheck,
  Lock,
  LogOut,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

type MinRole = "admin" | "scheduler" | "visitor";

const allMenuItems: { name: string; href: string; icon: any; minRole: MinRole }[] = [
  { name: "儀表板", href: "/dashboard", icon: LayoutDashboard, minRole: "admin" },
  { name: "人員管理", href: "/members", icon: Users, minRole: "admin" },
  { name: "週四報名", href: "/thursday", icon: ClipboardCheck, minRole: "visitor" },
  { name: "產出班表", href: "/generate", icon: CalendarPlus, minRole: "admin" },
  { name: "查看班表", href: "/schedule", icon: CalendarDays, minRole: "visitor" },
];

const roleLabels = {
  admin: "🔓 管理員",
  scheduler: "🔓 排班人",
  visitor: "",
};

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { isAdmin, isScheduler, role, login, logout } = useAuth();

  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Filter menu items based on role
  const menuItems = allMenuItems.filter((item) => {
    if (item.minRole === "visitor") return true;
    if (item.minRole === "scheduler") return isScheduler;
    if (item.minRole === "admin") return isAdmin;
    return false;
  });

  const handleLogin = async () => {
    setPinError("");
    setLoginLoading(true);
    const ok = await login(pin);
    setLoginLoading(false);
    if (ok) {
      setShowPinInput(false);
      setPin("");
    } else {
      setPinError("密碼錯誤");
      setPin("");
    }
  };

  const handleLogout = () => {
    logout();
    setShowPinInput(false);
    setPin("");
    setPinError("");
  };

  const isLoggedIn = role === "admin" || role === "scheduler";

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden bg-zinc-950 border-b border-zinc-800/50 px-4 py-3 flex items-center justify-between">
        <button 
          onClick={() => setOpen(true)} 
          className="p-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-lg"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-sm font-bold text-blue-400">音控排班</span>
        {isLoggedIn ? (
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-400"
          >
            <LogOut className="w-3.5 h-3.5" />
            {role === "admin" ? "管理員" : "排班人"}
          </button>
        ) : (
          <button
            onClick={() => { setOpen(true); setShowPinInput(true); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-400"
          >
            <Lock className="w-3.5 h-3.5" />
            登入
          </button>
        )}
      </div>

      {open && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm" 
          onClick={() => setOpen(false)} 
        />
      )}

      <aside className={`
        fixed left-0 top-0 h-screen w-72 bg-zinc-950 border-r border-zinc-800/50 p-5 z-50
        transition-transform duration-300 ease-in-out flex flex-col
        ${open ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0
      `}>
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
        
        <nav className="space-y-1.5 flex-1">
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
        
        <div className="mt-4 space-y-2">
          {isLoggedIn ? (
            <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/30">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium flex items-center gap-1.5 ${role === "admin" ? "text-amber-400" : "text-blue-400"}`}>
                  {roleLabels[role]}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  登出
                </button>
              </div>
            </div>
          ) : showPinInput ? (
            <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/30 space-y-2">
              <p className="text-xs text-zinc-500">輸入密碼</p>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="密碼"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none placeholder-zinc-600"
                autoFocus
              />
              {pinError && <p className="text-red-400 text-xs">{pinError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleLogin}
                  disabled={loginLoading || !pin}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
                >
                  {loginLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "登入"}
                </button>
                <button
                  onClick={() => { setShowPinInput(false); setPin(""); setPinError(""); }}
                  className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white text-xs py-2 rounded-lg transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowPinInput(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-900/50 hover:bg-zinc-800/60 rounded-xl border border-zinc-800/30 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
            >
              <Lock className="w-4 h-4" />
              🔑 登入
            </button>
          )}

          <div className="p-3 bg-zinc-900/30 rounded-xl border border-zinc-800/20">
            <p className="text-[11px] text-zinc-600 text-center">
              © 2026 Sound Team Scheduler
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
