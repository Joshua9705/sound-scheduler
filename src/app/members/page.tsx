import { db } from "@/lib/db";
import { CheckCircle2, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const members = await db.execute(`
    SELECT m.*, 
           GROUP_CONCAT(DISTINCT ts.name) as slots,
           GROUP_CONCAT(DISTINCT r.name || (CASE WHEN mr.is_learning = 1 THEN '(學)' ELSE '' END)) as roles
    FROM members m
    LEFT JOIN member_slots ms ON m.id = ms.member_id
    LEFT JOIN time_slots ts ON ms.slot_id = ts.id
    LEFT JOIN member_roles mr ON m.id = mr.member_id
    LEFT JOIN roles r ON mr.role_id = r.id
    GROUP BY m.id
    ORDER BY m.level ASC, m.name ASC
  `);

  const levelLabel = (level: number) => {
    const labels: Record<number, string> = { 1: "⭐ 資深", 2: "🔵 進階", 3: "🟢 一般", 4: "🔰 新手" };
    return labels[level] || `Lv.${level}`;
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">👥 人員管理</h2>
        <p className="text-zinc-500 mt-3 text-base">管理音控團隊成員、服事時段與角色能力。</p>
      </header>

      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {members.rows.map((member: any) => (
          <div key={member.id} className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold shadow-md">
                  {member.name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold">{member.name}</div>
                  <div className="text-xs text-zinc-500">{levelLabel(member.level)}</div>
                </div>
              </div>
              {member.active ? (
                <span className="text-emerald-400 text-xs flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />活躍</span>
              ) : (
                <span className="text-zinc-600 text-xs flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />停用</span>
              )}
            </div>
            <div className="space-y-2">
              <div>
                <span className="text-[11px] text-zinc-600 block mb-1">可服事時段</span>
                <div className="flex flex-wrap gap-1.5">
                  {member.slots ? member.slots.split(',').map((slot: string, i: number) => (
                    <span key={i} className="px-2.5 py-1 bg-zinc-800/50 border border-zinc-700/30 rounded-lg text-xs text-zinc-300">{slot}</span>
                  )) : <span className="text-zinc-700 text-xs">—</span>}
                </div>
              </div>
              <div>
                <span className="text-[11px] text-zinc-600 block mb-1">角色能力</span>
                <div className="flex flex-wrap gap-1.5">
                  {member.roles ? member.roles.split(',').map((role: string, i: number) => (
                    <span key={i} className={`px-2.5 py-1 rounded-lg text-xs border ${
                      role.includes('(學)') 
                        ? "bg-purple-500/10 text-purple-300 border-purple-500/20" 
                        : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                    }`}>{role}</span>
                  )) : <span className="text-zinc-700 text-xs">—</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block bg-zinc-900/50 rounded-2xl border border-zinc-800/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-800/30 border-b border-zinc-800/50">
              <tr>
                <th className="px-6 py-4 font-semibold text-sm text-zinc-400">姓名</th>
                <th className="px-6 py-4 font-semibold text-sm text-zinc-400 text-center">等級</th>
                <th className="px-6 py-4 font-semibold text-sm text-zinc-400 text-center">狀態</th>
                <th className="px-6 py-4 font-semibold text-sm text-zinc-400">可服事時段</th>
                <th className="px-6 py-4 font-semibold text-sm text-zinc-400">角色能力</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/30">
              {members.rows.map((member: any) => (
                <tr key={member.id} className="hover:bg-zinc-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold shadow-md">
                        {member.name.charAt(0)}
                      </div>
                      <span className="font-medium">{member.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm">{levelLabel(member.level)}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {member.active ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 text-sm"><CheckCircle2 className="w-4 h-4" />活躍</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-zinc-600 text-sm"><XCircle className="w-4 h-4" />停用</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {member.slots ? member.slots.split(',').map((slot: string, i: number) => (
                        <span key={i} className="px-2.5 py-1 bg-zinc-800/50 border border-zinc-700/30 rounded-lg text-xs text-zinc-300">{slot}</span>
                      )) : <span className="text-zinc-700 text-xs">—</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {member.roles ? member.roles.split(',').map((role: string, i: number) => (
                        <span key={i} className={`px-2.5 py-1 rounded-lg text-xs border ${
                          role.includes('(學)') 
                            ? "bg-purple-500/10 text-purple-300 border-purple-500/20" 
                            : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                        }`}>{role}</span>
                      )) : <span className="text-zinc-700 text-xs">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
