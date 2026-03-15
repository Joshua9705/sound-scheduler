import { db } from "@/lib/db";
import { 
  Users, 
  CalendarCheck, 
  Clock, 
  Award 
} from "lucide-react";
import AdminGuard from "@/components/AdminGuard";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const members = await db.execute("SELECT COUNT(*) as count FROM members WHERE active = 1");
  const schedules = await db.execute("SELECT COUNT(*) as count FROM schedules");
  const assignments = await db.execute("SELECT COUNT(*) as count FROM assignments");
  const activeSchedules = await db.execute("SELECT * FROM schedules ORDER BY quarter DESC LIMIT 1");

  const memberCount = Number(members.rows[0].count);
  const scheduleCount = Number(schedules.rows[0].count);
  const assignmentCount = Number(assignments.rows[0].count);
  const latestSchedule = activeSchedules.rows[0] ? String(activeSchedules.rows[0].quarter) : "尚無班表";

  const memberStats = await db.execute(`
    SELECT m.name, m.level, COUNT(a.id) as count
    FROM members m
    LEFT JOIN assignments a ON m.id = a.member_id
    LEFT JOIN schedules s ON a.schedule_id = s.id
    WHERE m.active = 1 AND (s.quarter = ? OR s.quarter IS NULL)
    GROUP BY m.id
    ORDER BY count DESC
  `, [latestSchedule]);

  return (
    <AdminGuard>
    <div className="space-y-10">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">👋 儀表板概覽</h2>
        <p className="text-zinc-500 mt-3 text-base leading-relaxed">歡迎回來，以下是音控團隊的排班現況。</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard icon={Users} label="活躍成員" value={memberCount} unit="人" color="blue" />
        <StatCard icon={CalendarCheck} label="總班表數" value={scheduleCount} unit="季" color="emerald" />
        <StatCard icon={Clock} label="目前季度" value={latestSchedule} unit="" color="amber" />
        <StatCard icon={Award} label="總排班數" value={assignmentCount} unit="筆" color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className="lg:col-span-3 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">📊 本季服事統計</h3>
            <span className="text-[11px] text-zinc-600 bg-zinc-800/50 px-2.5 py-1 rounded-full">{latestSchedule}</span>
          </div>
          <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
            {memberStats.rows.length === 0 ? (
              <p className="text-zinc-600 text-center py-8">尚無排班資料</p>
            ) : (
              memberStats.rows.map((row: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-800/30 border border-zinc-800/30 hover:bg-zinc-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold shadow-md">
                      {String(row.name).charAt(0)}
                    </div>
                    <div>
                      <span className="font-medium text-sm">{row.name}</span>
                      <span className="text-[11px] text-zinc-600 ml-2">Lv.{row.level}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-zinc-700/50 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-500 h-full rounded-full transition-all duration-700" 
                        style={{ width: `${Math.min((Number(row.count) / 8) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="font-bold text-blue-400 text-sm w-8 text-right">{row.count}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="lg:col-span-2 bg-gradient-to-br from-blue-600/10 to-indigo-600/10 rounded-2xl border border-blue-500/10 p-6 md:p-8 flex flex-col justify-center items-center text-center">
          <div className="p-5 bg-blue-500/10 rounded-2xl mb-5">
            <CalendarCheck className="w-14 h-14 text-blue-400" />
          </div>
          <h3 className="text-xl font-bold mb-3">快速開始</h3>
          <p className="text-zinc-400 mb-6 text-sm leading-relaxed max-w-xs">
            準備好為下一季度安排人員了嗎？<br/>點擊按鈕即可一鍵產出班表。
          </p>
          <a 
            href="/generate" 
            className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 active:scale-95 text-sm"
          >
            🚀 產出新季度班表
          </a>
        </section>
      </div>
    </div>
    </AdminGuard>
  );
}

function StatCard({ icon: Icon, label, value, unit, color }: any) {
  const colors: any = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/10",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/10",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/10",
  };

  return (
    <div className="bg-zinc-900/50 p-5 md:p-6 rounded-2xl border border-zinc-800/50 hover:border-zinc-700/50 transition-all group">
      <div className={`p-2.5 rounded-xl w-fit mb-4 border ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xs font-medium text-zinc-500 mb-1">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <h4 className="text-2xl md:text-3xl font-bold">{value}</h4>
        {unit && <span className="text-xs text-zinc-600">{unit}</span>}
      </div>
    </div>
  );
}
