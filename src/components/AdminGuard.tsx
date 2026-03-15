"use client";

import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, login } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAdmin) return <>{children}</>;

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    const ok = await login(pin);
    setLoading(false);
    if (!ok) {
      setError("密碼錯誤");
      setPin("");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-zinc-900/70 border border-zinc-800/50 rounded-2xl p-8 w-full max-w-sm space-y-6 text-center shadow-xl">
        <div className="flex justify-center">
          <div className="p-4 bg-zinc-800/60 rounded-2xl">
            <Lock className="w-10 h-10 text-zinc-400" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">需要管理員權限</h2>
          <p className="text-zinc-500 text-sm mt-2">請輸入管理員密碼以繼續</p>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="輸入管理員密碼"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 focus:outline-none placeholder-zinc-600 text-center tracking-widest"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={loading || !pin}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {loading ? "驗證中..." : "登入"}
          </button>
        </div>
      </div>
    </div>
  );
}
