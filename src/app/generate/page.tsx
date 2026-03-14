"use client";

import { useState } from "react";
import { CalendarPlus, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function GeneratePage() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);
  const nextQuarter = currentQuarter >= 4 ? 1 : currentQuarter + 1;
  const nextYear = currentQuarter >= 4 ? currentYear + 1 : currentYear;

  const [year, setYear] = useState(nextYear);
  const [q, setQ] = useState(nextQuarter);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const quarter = `${year}-Q${q}`;

  async function handleGenerate() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/schedule/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quarter }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "產出失敗");
        return;
      }
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`確定要刪除 ${quarter} 的班表嗎？`)) return;
    setLoading(true);
    try {
      await fetch(`/api/schedule?quarter=${quarter}`, { method: "DELETE" });
      setResult(null);
      setError("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">產出季度班表</h2>
        <p className="text-zinc-400 mt-2 text-lg">選擇季度後一鍵自動產出 3 個月的排班表。</p>
      </header>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-8 shadow-xl max-w-xl">
        <div className="flex gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">年份</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
            >
              {[currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">季度</label>
            <select
              value={q}
              onChange={(e) => setQ(Number(e.target.value))}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
            >
              <option value={1}>Q1（1-3月）</option>
              <option value={2}>Q2（4-6月）</option>
              <option value={3}>Q3（7-9月）</option>
              <option value={4}>Q4（10-12月）</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarPlus className="w-5 h-5" />}
            產出 {quarter} 班表
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-3 bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/20 rounded-lg font-medium transition-all disabled:opacity-50"
          >
            刪除此季班表
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-400">錯誤</p>
            <p className="text-red-300 mt-1">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-emerald-400">班表產出成功！</p>
              <p className="text-emerald-300 mt-1">
                {quarter} 共產出 <strong>{result.totalAssignments}</strong> 筆排班
              </p>
            </div>
          </div>

          {result.warnings?.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6">
              <p className="font-bold text-amber-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> 警告
              </p>
              <ul className="space-y-1 text-amber-300 text-sm">
                {result.warnings.map((w: string, i: number) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {result.monthSummary?.map((ms: any) => (
            <div key={ms.month} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl">
              <h3 className="text-lg font-bold mb-4">{ms.month} 排班統計</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {ms.members.map((m: any) => (
                  <div key={m.memberId} className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 flex justify-between items-center">
                    <span className="text-sm">{m.name}</span>
                    <span className="font-bold text-blue-400">{m.count} 次</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="text-center">
            <a href="/schedule" className="text-blue-400 hover:text-blue-300 underline font-medium">
              → 查看完整班表
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
