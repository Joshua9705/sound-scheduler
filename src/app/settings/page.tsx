"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, Save, Loader2, CheckCircle2 } from "lucide-react";
import SchedulerGuard from "@/components/SchedulerGuard";

interface Requirement {
  slot_id: number;
  role_id: number;
  slot_name: string;
  role_name: string;
  min_count: number;
  max_count: number;
}

export default function SettingsPage() {
  const [reqs, setReqs] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/requirements");
      setReqs(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(req: Requirement) {
    const key = `${req.slot_id}:${req.role_id}`;
    setSaving(key);
    await fetch("/api/requirements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slot_id: req.slot_id,
        role_id: req.role_id,
        min_count: req.min_count,
        max_count: req.max_count,
      }),
    });
    setSaving(null);
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  }

  function updateReq(slot_id: number, role_id: number, field: "min_count" | "max_count", value: number) {
    setReqs((prev) =>
      prev.map((r) =>
        r.slot_id === slot_id && r.role_id === role_id ? { ...r, [field]: value } : r
      )
    );
  }

  const roleColor = (roleName: string) => {
    switch (roleName) {
      case "PA": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "Stage": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "線上": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      default: return "bg-zinc-700 text-zinc-300 border-zinc-600";
    }
  };

  // Group by slot
  const bySlot: Record<string, Requirement[]> = {};
  for (const r of reqs) {
    if (!bySlot[r.slot_name]) bySlot[r.slot_name] = [];
    bySlot[r.slot_name].push(r);
  }

  return (
    <SchedulerGuard>
      <div className="space-y-8 animate-in fade-in duration-500">
        <header>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-400" />
            排班人數設定
          </h2>
          <p className="text-zinc-400 mt-2 text-lg">調整各場次 PA / Stage / 線上的最少與最多人數。</p>
        </header>

        {loading && (
          <div className="flex items-center gap-2 text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            載入中...
          </div>
        )}

        {!loading && (
          <div className="grid gap-6 md:grid-cols-2">
            {Object.entries(bySlot).map(([slotName, roles]) => (
              <div key={slotName} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-lg font-bold mb-4 text-white">{slotName}</h3>
                <div className="space-y-4">
                  {roles.map((r) => {
                    const key = `${r.slot_id}:${r.role_id}`;
                    const isSaving = saving === key;
                    const isSaved = saved === key;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs border w-14 text-center flex-shrink-0 ${roleColor(r.role_name)}`}>
                          {r.role_name}
                        </span>
                        <div className="flex items-center gap-2 flex-1">
                          <label className="text-xs text-zinc-500 w-8">最少</label>
                          <input
                            type="number"
                            min={0}
                            max={r.max_count}
                            value={r.min_count}
                            onChange={(e) => updateReq(r.slot_id, r.role_id, "min_count", Number(e.target.value))}
                            className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none text-center"
                          />
                          <label className="text-xs text-zinc-500 w-8">最多</label>
                          <input
                            type="number"
                            min={r.min_count}
                            max={10}
                            value={r.max_count}
                            onChange={(e) => updateReq(r.slot_id, r.role_id, "max_count", Number(e.target.value))}
                            className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none text-center"
                          />
                        </div>
                        <button
                          onClick={() => handleSave(r)}
                          disabled={isSaving}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-xs text-white transition-colors"
                        >
                          {isSaving ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isSaved ? (
                            <CheckCircle2 className="w-3 h-3 text-green-400" />
                          ) : (
                            <Save className="w-3 h-3" />
                          )}
                          {isSaved ? "已儲存" : "儲存"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 text-sm text-zinc-500">
          <p>💡 <strong className="text-zinc-400">說明：</strong>「最多」人數決定排班時最多能新增幾個人到同一角色；班表檢視中，已達上限的角色將不再顯示新增按鈕。</p>
        </div>
      </div>
    </SchedulerGuard>
  );
}
