"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";

interface Assignment {
  id: number;
  date: string;
  slot_id: number;
  slot_name: string;
  role_id: number;
  role_name: string;
  member_id: number;
  member_name: string;
  member_level: number;
}

const SLOT_ORDER = [
  { id: 1, name: "週四晚上" },
  { id: 2, name: "週六晚上" },
  { id: 3, name: "週日早上" },
  { id: 4, name: "週日下午" },
];

export default function SchedulePage() {
  const currentYear = new Date().getFullYear();
  const currentQ = Math.ceil((new Date().getMonth() + 1) / 3);

  const [year, setYear] = useState(currentYear);
  const [q, setQ] = useState(currentQ);
  const [data, setData] = useState<{ schedule: any; assignments: Assignment[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);

  const quarter = `${year}-Q${q}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, memRes] = await Promise.all([
        fetch(`/api/schedule?quarter=${quarter}`),
        fetch("/api/members"),
      ]);
      setData(await schedRes.json());
      setMembers(await memRes.json());
    } finally {
      setLoading(false);
    }
  }, [quarter]);

  useEffect(() => { load(); }, [load]);

  function prevQuarter() {
    if (q === 1) { setQ(4); setYear(year - 1); }
    else setQ(q - 1);
  }

  function nextQuarter() {
    if (q === 4) { setQ(1); setYear(year + 1); }
    else setQ(q + 1);
  }

  // Group assignments by date
  const byDate: Record<string, Assignment[]> = {};
  if (data?.assignments) {
    for (const a of data.assignments) {
      if (!byDate[a.date]) byDate[a.date] = [];
      byDate[a.date].push(a);
    }
  }

  const sortedDates = Object.keys(byDate).sort();

  // Group dates by month
  const byMonth: Record<string, string[]> = {};
  for (const d of sortedDates) {
    const m = d.substring(0, 7);
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(d);
  }

  async function handleSwap(assignmentId: number, newMemberId: number) {
    await fetch("/api/schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment_id: assignmentId, member_id: newMemberId }),
    });
    load();
  }

  // Check rule violations for a session
  function getWarnings(sessionAssignments: Assignment[]): string[] {
    const warnings: string[] = [];
    const hasLowLevel = sessionAssignments.some((a) => a.member_level >= 3);
    const hasHighLevel = sessionAssignments.some((a) => a.member_level <= 2);
    if (hasLowLevel && !hasHighLevel) {
      warnings.push("等級 3-4 成員沒有等級 1-2 搭配");
    }
    return warnings;
  }

  const dayLabel = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  };

  const levelColor = (level: number) => {
    if (level <= 2) return "text-amber-400";
    return "text-blue-400";
  };

  const roleColor = (roleName: string) => {
    switch (roleName) {
      case "PA": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "Stage": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "線上": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      default: return "bg-zinc-700 text-zinc-300";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">班表檢視</h2>
          <p className="text-zinc-400 mt-2 text-lg">查看與微調季度排班表。</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={prevQuarter} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-bold px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg min-w-[120px] text-center">
            {quarter}
          </span>
          <button onClick={nextQuarter} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </header>

      {loading && <p className="text-zinc-500">載入中...</p>}

      {!loading && !data?.schedule && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <CalendarDays className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
          <p className="text-xl font-bold text-zinc-500">尚無 {quarter} 班表</p>
          <p className="text-zinc-600 mt-2">請至「產出班表」頁面建立。</p>
        </div>
      )}

      {!loading && data?.schedule && Object.entries(byMonth).map(([month, dates]) => (
        <div key={month} className="space-y-4">
          <h3 className="text-xl font-bold border-b border-zinc-800 pb-2">{month}</h3>
          
          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-sm text-zinc-500 w-28">日期</th>
                  {SLOT_ORDER.map((s) => (
                    <th key={s.id} className="text-left px-4 py-3 text-sm text-zinc-500">{s.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dates.map((date) => {
                  const dateAssignments = byDate[date] || [];
                  return (
                    <tr key={date} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                      <td className="px-4 py-4 font-medium">
                        <div className="text-sm">{date}</div>
                        <div className="text-xs text-zinc-500">週{dayLabel(date)}</div>
                      </td>
                      {SLOT_ORDER.map((slot) => {
                        const slotAssignments = dateAssignments.filter((a) => a.slot_id === slot.id);
                        const warnings = getWarnings(slotAssignments);
                        return (
                          <td key={slot.id} className="px-4 py-4">
                            {slotAssignments.length === 0 ? (
                              <span className="text-zinc-700 text-xs">—</span>
                            ) : (
                              <div className="space-y-2">
                                {slotAssignments.map((a) => (
                                  <div key={a.id} className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-xs border ${roleColor(a.role_name)}`}>
                                      {a.role_name}
                                    </span>
                                    <select
                                      value={a.member_id}
                                      onChange={(e) => handleSwap(a.id, Number(e.target.value))}
                                      className={`bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm ${levelColor(a.member_level)} focus:border-blue-500 focus:outline-none`}
                                    >
                                      {members.map((m: any) => (
                                        <option key={m.id} value={m.id}>{m.name} (Lv{m.level})</option>
                                      ))}
                                    </select>
                                  </div>
                                ))}
                                {warnings.map((w, i) => (
                                  <div key={i} className="flex items-center gap-1 text-amber-500 text-xs">
                                    <AlertTriangle className="w-3 h-3" />
                                    {w}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden space-y-3">
            {dates.map((date) => {
              const dateAssignments = byDate[date] || [];
              return (
                <div key={date} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="font-bold mb-3 text-sm">{date}（週{dayLabel(date)}）</div>
                  {SLOT_ORDER.map((slot) => {
                    const slotAssignments = dateAssignments.filter((a) => a.slot_id === slot.id);
                    if (slotAssignments.length === 0) return null;
                    return (
                      <div key={slot.id} className="mb-3 last:mb-0">
                        <div className="text-xs text-zinc-500 mb-1">{slot.name}</div>
                        {slotAssignments.map((a) => (
                          <div key={a.id} className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs border ${roleColor(a.role_name)}`}>
                              {a.role_name}
                            </span>
                            <span className={`text-sm ${levelColor(a.member_level)}`}>{a.member_name}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
