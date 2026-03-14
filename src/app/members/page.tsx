import { db } from "@/lib/db";
import { UserPlus, UserCog, CheckCircle2, XCircle } from "lucide-react";

export default async function MembersPage() {
  const members = await db.execute(`
    SELECT m.*, 
           GROUP_CONCAT(DISTINCT ts.name) as slots,
           GROUP_CONCAT(DISTINCT r.name || (CASE WHEN mr.is_learning = 1 THEN ' (實習)' ELSE '' END)) as roles
    FROM members m
    LEFT JOIN member_slots ms ON m.id = ms.member_id
    LEFT JOIN time_slots ts ON ms.slot_id = ts.id
    LEFT JOIN member_roles mr ON m.id = mr.member_id
    LEFT JOIN roles r ON mr.role_id = r.id
    GROUP BY m.id
    ORDER BY m.level ASC, m.name ASC
  `);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">人員管理</h2>
          <p className="text-zinc-400 mt-2 text-lg">管理音控團隊成員、服事時間與角色能力。</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95 disabled:opacity-50" disabled>
          <UserPlus className="w-5 h-5" />
          新增成員
        </button>
      </header>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-800/50 border-b border-zinc-700/50">
              <tr>
                <th className="px-6 py-4 font-semibold">姓名</th>
                <th className="px-6 py-4 font-semibold text-center">等級</th>
                <th className="px-6 py-4 font-semibold text-center">狀態</th>
                <th className="px-6 py-4 font-semibold">可服事時段</th>
                <th className="px-6 py-4 font-semibold">角色能力</th>
                <th className="px-6 py-4 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {members.rows.map((member: any) => (
                <tr key={member.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold shadow-lg">
                        {member.name.charAt(0)}
                      </div>
                      <span className="font-medium text-zinc-100">{member.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      member.level <= 2 
                        ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
                        : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                    }`}>
                      LV {member.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {member.active ? (
                      <span className="inline-flex items-center gap-1 text-emerald-500 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" /> 活躍
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-zinc-500 text-sm font-medium">
                        <XCircle className="w-4 h-4" /> 停用
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {member.slots ? member.slots.split(',').map((slot: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300">
                          {slot}
                        </span>
                      )) : <span className="text-zinc-600 text-xs italic">無</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {member.roles ? member.roles.split(',').map((role: string, i: number) => (
                        <span key={i} className={`px-2 py-0.5 rounded text-xs border ${
                          role.includes('(實習)') 
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20" 
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}>
                          {role}
                        </span>
                      )) : <span className="text-zinc-600 text-xs italic">無</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors" title="編輯人員">
                      <UserCog className="w-5 h-5" />
                    </button>
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
