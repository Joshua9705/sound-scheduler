"use client";

import { useEffect, useState, useCallback } from "react";
import { ClipboardCheck, Calendar, Users, AlertCircle, CheckCircle2, Loader2, ChevronLeft, ChevronRight, Lock, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface Member {
  id: number;
  name: string;
}

interface Signup {
  id: number;
  member_id: number;
  member_name: string;
  date: string;
  role_id: number;
  role_name: string;
}

interface ThursdayData {
  quarter: string;
  dates: string[];
  signups: Signup[];
  members: Member[];
  deadline: string;
  isOpen: boolean;
}

function getInitials(name: string): string {
  return name.slice(0, 1);
}

function getGradient(id: number): string {
  const gradients = [
    "from-blue-500 to-cyan-500",
    "from-violet-500 to-purple-500",
    "from-emerald-500 to-teal-500",
    "from-orange-500 to-amber-500",
    "from-rose-500 to-pink-500",
    "from-indigo-500 to-blue-500",
    "from-fuchsia-500 to-violet-500",
    "from-sky-500 to-blue-500",
  ];
  return gradients[id % gradients.length];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

function formatDeadline(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["日", "一", "二", "三", "四", "五", "六"];
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}（${days[d.getDay()]}）`;
}

function getCurrentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

function prevQuarter(q: string): string {
  const [year, qn] = q.split("-Q").map(Number);
  if (qn === 1) return `${year - 1}-Q4`;
  return `${year}-Q${qn - 1}`;
}

function nextQuarter(q: string): string {
  const [year, qn] = q.split("-Q").map(Number);
  if (qn === 4) return `${year + 1}-Q1`;
  return `${year}-Q${qn + 1}`;
}

export default function ThursdayPage() {
  const { isAdmin, isScheduler, login, logout } = useAuth();
  const [quarter, setQuarter] = useState(getCurrentQuarter());
  const [data, setData] = useState<ThursdayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  // Identity: which member am I?
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [adminError, setAdminError] = useState("");

  // Restore from localStorage
  useEffect(() => {
    const savedId = localStorage.getItem("thursday_member_id");
    if (savedId) setSelectedMemberId(Number(savedId));
  }, []);

  const fetchData = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/thursday-signups?quarter=${q}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(quarter);
  }, [quarter, fetchData]);

  const handleSelectMember = (id: number) => {
    setSelectedMemberId(id);
    localStorage.setItem("thursday_member_id", String(id));
  };

  const handleAdminLogin = async () => {
    setAdminError("");
    const ok = await login(adminPin);
    if (ok) {
      setShowAdminLogin(false);
      setAdminPin("");
    } else {
      setAdminError("密碼錯誤");
    }
  };

  const handleAdminLogout = () => {
    logout();
  };

  const getSignup = (memberId: number, date: string, roleId: number): Signup | undefined => {
    return data?.signups.find(
      (s) => s.member_id === memberId && s.date === date && s.role_id === roleId
    );
  };

  const handleToggle = async (member: Member, date: string, roleId: number) => {
    if (!data?.isOpen) return;
    const key = `${member.id}:${date}:${roleId}`;
    if (toggling === key) return;
    setToggling(key);

    const existing = getSignup(member.id, date, roleId);
    try {
      if (existing) {
        await fetch(`/api/thursday-signups?id=${existing.id}`, { method: "DELETE" });
      } else {
        await fetch("/api/thursday-signups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ member_id: member.id, date, role_id: roleId, quarter }),
        });
      }
      await fetchData(quarter);
    } finally {
      setToggling(null);
    }
  };

  const getDateCount = (date: string, roleId: number): number => {
    return data?.signups.filter((s) => s.date === date && s.role_id === roleId).length ?? 0;
  };

  // Which members to show
  const visibleMembers = data?.members.filter((m) => {
    if (isScheduler) return true; // admin sees all
    return m.id === selectedMemberId; // regular user sees only themselves
  }) ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span>載入中...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Step 1: If not admin and no member selected, show member selector
  if (!isScheduler && !selectedMemberId) {
    return (
      <div className="space-y-6 max-w-lg mx-auto">
        <div className="text-center pt-8">
          <div className="p-3 bg-blue-600/20 rounded-2xl inline-block mb-4">
            <ClipboardCheck className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">週四報名</h1>
          <p className="text-zinc-500 mt-2">請先選擇你的名字</p>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
          <div className="divide-y divide-zinc-800/30">
            {data.members.map((member) => (
              <button
                key={member.id}
                onClick={() => handleSelectMember(member.id)}
                className="w-full px-5 py-4 flex items-center gap-3 hover:bg-zinc-800/40 transition-colors text-left"
              >
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getGradient(member.id)} flex items-center justify-center text-white font-bold`}>
                  {getInitials(member.name)}
                </div>
                <span className="text-white font-medium">{member.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Admin login link */}
        <div className="text-center">
          {showAdminLogin ? (
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-5 space-y-3 max-w-xs mx-auto">
              <p className="text-sm text-zinc-400">輸入管理員密碼查看所有報名</p>
              <input
                type="password"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                placeholder="密碼"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                autoFocus
              />
              {adminError && <p className="text-red-400 text-xs">{adminError}</p>}
              <div className="flex gap-2">
                <button onClick={handleAdminLogin} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 rounded-lg">登入</button>
                <button onClick={() => { setShowAdminLogin(false); setAdminPin(""); setAdminError(""); }} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white text-sm py-2 rounded-lg">取消</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdminLogin(true)} className="text-zinc-600 hover:text-zinc-400 text-xs flex items-center gap-1 mx-auto transition-colors">
              <Lock className="w-3 h-3" /> 管理員查看全部
            </button>
          )}
        </div>
      </div>
    );
  }

  const selectedMember = data.members.find((m) => m.id === selectedMemberId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-xl">
              <ClipboardCheck className="w-7 h-7 text-blue-400" />
            </div>
            週四報名
          </h1>
          {isScheduler ? (
            <div className="flex items-center gap-2 mt-1 ml-1">
              <span className="text-amber-400 text-sm font-medium">🔓 管理員模式 — 查看所有人報名</span>
              <button onClick={handleAdminLogout} className="text-zinc-500 hover:text-zinc-300 text-xs flex items-center gap-1 transition-colors">
                <LogOut className="w-3 h-3" /> 登出
              </button>
            </div>
          ) : selectedMember ? (
            <div className="flex items-center gap-2 mt-1 ml-1">
              <span className="text-zinc-500 text-sm">
                登記為：<span className="text-white font-medium">{selectedMember.name}</span>
              </span>
              <button
                onClick={() => { setSelectedMemberId(null); localStorage.removeItem("thursday_member_id"); }}
                className="text-zinc-600 hover:text-zinc-400 text-xs underline transition-colors"
              >
                切換
              </button>
            </div>
          ) : null}
        </div>

        {/* Quarter selector */}
        <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-1">
          <button
            onClick={() => setQuarter(prevQuarter(quarter))}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1 text-sm font-mono text-white min-w-[90px] text-center">{quarter}</span>
          <button
            onClick={() => setQuarter(nextQuarter(quarter))}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Deadline Banner */}
      <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${
        data.isOpen
          ? "bg-blue-950/30 border-blue-800/40 text-blue-300"
          : "bg-red-950/30 border-red-800/40 text-red-300"
      }`}>
        {data.isOpen ? (
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
        )}
        <div>
          {data.isOpen ? (
            <span>
              <span className="font-semibold">報名開放中</span>
              {" — "}截止日：<span className="font-mono">{formatDeadline(data.deadline)}</span>
            </span>
          ) : (
            <span className="font-semibold">報名已截止（截止日：{formatDeadline(data.deadline)}）</span>
          )}
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-zinc-800/50 bg-zinc-900/30">
        <table className="w-full min-w-max">
          <thead>
            <tr className="border-b border-zinc-800/50">
              <th className="text-left px-5 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-40">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  成員
                </div>
              </th>
              {data.dates.map((date) => (
                <th key={date} className="px-3 py-4 text-center min-w-[90px]">
                  <div className="text-sm font-semibold text-white">{formatDate(date)}</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">週四</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/30">
            {visibleMembers.map((member) => (
              <tr key={member.id} className="hover:bg-zinc-800/20 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getGradient(member.id)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                      {getInitials(member.name)}
                    </div>
                    <span className="text-sm font-medium text-white">{member.name}</span>
                  </div>
                </td>
                {data.dates.map((date) => {
                  const paSignup = getSignup(member.id, date, 1);
                  const stageSignup = getSignup(member.id, date, 2);
                  const paKey = `${member.id}:${date}:1`;
                  const stageKey = `${member.id}:${date}:2`;
                  // Only allow toggle for own row (or admin)
                  const canToggle = isScheduler || member.id === selectedMemberId;

                  return (
                    <td key={date} className="px-3 py-3 text-center">
                      <div className="flex flex-col gap-1.5 items-center">
                        <button
                          onClick={() => canToggle && handleToggle(member, date, 1)}
                          disabled={!data.isOpen || toggling === paKey || !canToggle}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all min-w-[52px] ${
                            paSignup
                              ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                              : data.isOpen && canToggle
                              ? "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                              : "bg-zinc-800/50 text-zinc-600 cursor-default"
                          } ${toggling === paKey ? "opacity-50" : ""}`}
                        >
                          {toggling === paKey ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "PA"}
                        </button>
                        <button
                          onClick={() => canToggle && handleToggle(member, date, 2)}
                          disabled={!data.isOpen || toggling === stageKey || !canToggle}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all min-w-[52px] ${
                            stageSignup
                              ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                              : data.isOpen && canToggle
                              ? "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                              : "bg-zinc-800/50 text-zinc-600 cursor-default"
                          } ${toggling === stageKey ? "opacity-50" : ""}`}
                        >
                          {toggling === stageKey ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "台"}
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Summary Row — only for admin */}
            {isScheduler && (
              <tr className="bg-zinc-900/50 border-t border-zinc-700/50">
                <td className="px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    小計
                  </div>
                </td>
                {data.dates.map((date) => (
                  <td key={date} className="px-3 py-3 text-center">
                    <div className="flex flex-col gap-1 items-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                        getDateCount(date, 1) >= 1 ? "text-blue-300 bg-blue-950/50" : "text-zinc-600 bg-zinc-800/50"
                      }`}>PA: {getDateCount(date, 1)}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                        getDateCount(date, 2) >= 1 ? "text-emerald-300 bg-emerald-950/50" : "text-zinc-600 bg-zinc-800/50"
                      }`}>台: {getDateCount(date, 2)}</span>
                    </div>
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {data.dates.map((date) => (
          <div key={date} className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-zinc-500" />
                <span className="font-semibold text-white">{formatDate(date)} 週四</span>
              </div>
              {isScheduler && (
                <div className="flex gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-md font-bold ${
                    getDateCount(date, 1) >= 1 ? "text-blue-300 bg-blue-950/50" : "text-zinc-600 bg-zinc-800/50"
                  }`}>PA: {getDateCount(date, 1)}</span>
                  <span className={`px-2 py-0.5 rounded-md font-bold ${
                    getDateCount(date, 2) >= 1 ? "text-emerald-300 bg-emerald-950/50" : "text-zinc-600 bg-zinc-800/50"
                  }`}>台: {getDateCount(date, 2)}</span>
                </div>
              )}
            </div>
            <div className="divide-y divide-zinc-800/30">
              {visibleMembers.map((member) => {
                const paSignup = getSignup(member.id, date, 1);
                const stageSignup = getSignup(member.id, date, 2);
                const paKey = `${member.id}:${date}:1`;
                const stageKey = `${member.id}:${date}:2`;
                const canToggle = isScheduler || member.id === selectedMemberId;

                return (
                  <div key={member.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getGradient(member.id)} flex items-center justify-center text-white text-sm font-bold`}>
                        {getInitials(member.name)}
                      </div>
                      <span className="text-sm text-white">{member.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => canToggle && handleToggle(member, date, 1)}
                        disabled={!data.isOpen || toggling === paKey || !canToggle}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          paSignup ? "bg-blue-600 text-white" : data.isOpen && canToggle ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" : "bg-zinc-800/50 text-zinc-600 cursor-default"
                        }`}
                      >
                        {toggling === paKey ? <Loader2 className="w-3 h-3 animate-spin" /> : "PA"}
                      </button>
                      <button
                        onClick={() => canToggle && handleToggle(member, date, 2)}
                        disabled={!data.isOpen || toggling === stageKey || !canToggle}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          stageSignup ? "bg-emerald-600 text-white" : data.isOpen && canToggle ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" : "bg-zinc-800/50 text-zinc-600 cursor-default"
                        }`}
                      >
                        {toggling === stageKey ? <Loader2 className="w-3 h-3 animate-spin" /> : "台"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {data.dates.length === 0 && (
        <div className="text-center py-16 text-zinc-600">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>本季無週四資料</p>
        </div>
      )}
    </div>
  );
}
