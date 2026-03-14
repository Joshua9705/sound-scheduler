import { db } from "@/lib/db";
import { 
  Users, 
  CalendarCheck, 
  Clock, 
  Award 
} from "lucide-react";

export default async function Dashboard() {
  const members = await db.execute("SELECT COUNT(*) as count FROM members WHERE active = 1");
  const schedules = await db.execute("SELECT COUNT(*) as count FROM schedules");
  const assignments = await db.execute("SELECT COUNT(*) as count FROM assignments");
  const activeSchedules = await db.execute("SELECT * FROM schedules ORDER BY quarter DESC LIMIT 1");

  const memberCount = Number(members.rows[0].count);
  const scheduleCount = Number(schedules.rows[0].count);
  const assignmentCount = Number(assignments.rows[0].count);
  const latestSchedule = activeSchedules.rows[0] ? String(activeSchedules.rows[0].quarter) : "無";

  // Get member stats for current quarter
  const memberStats = await db.execute(`
    SELECT m.name, COUNT(a.id) as count
    FROM members m
    LEFT JOIN assignments a ON m.id = a.member_id
    LEFT JOIN schedules s ON a.schedule_id = s.id
    WHERE m.active = 1 AND (s.quarter = ? OR s.quarter IS NULL)
    GROUP BY m.id
    ORDER BY count DESC
  `, [latestSchedule]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">儀表板概覽</h2>
        <p className="text-zinc-400 mt-2 text-lg">歡迎回來，這是目前音控團隊的排班現狀。</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={Users} 
          label="活躍成員" 
          value={memberCount} 
          description="名活躍的人員"
          color="blue"
        />
        <StatCard 
          icon={CalendarCheck} 
          label="總班表數" 
          value={scheduleCount} 
          description="個已產出的季度班表"
          color="emerald"
        />
        <StatCard 
          icon={Clock} 
          label="目前季度" 
          value={latestSchedule} 
          description="當前生效的班表"
          color="amber"
        />
        <StatCard 
          icon={Award} 
          label="總任務數" 
          value={assignmentCount} 
          description="個已指派的任務"
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">目前季度服事統計 ({latestSchedule})</h3>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">即時更新</span>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-auto pr-2 custom-scrollbar">
            {memberStats.rows.map((row: any, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800 transition-colors">
                <span className="font-medium">{row.name}</span>
                <div className="flex items-center gap-4">
                  <div className="w-32 bg-zinc-700 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${Math.min((Number(row.count) / 10) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="font-bold text-blue-400 w-6 text-right">{row.count}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 shadow-xl flex flex-col justify-center items-center text-center">
          <div className="p-4 bg-blue-500/10 rounded-full mb-4">
            <CalendarCheck className="w-12 h-12 text-blue-500" />
          </div>
          <h3 className="text-xl font-bold mb-2">快速開始</h3>
          <p className="text-zinc-400 mb-6 max-w-sm">
            準備好為下一季度安排人員了嗎？只需點擊下方按鈕即可開始產出新班表。
          </p>
          <a 
            href="/generate" 
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95"
          >
            產出新季度班表
          </a>
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, description, color }: any) {
  const colors: any = {
    blue: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    purple: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  };

  return (
    <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-lg hover:border-zinc-700 transition-all group">
      <div className={`p-3 rounded-lg w-fit mb-4 border transition-all group-hover:scale-110 ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-500">{label}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <h4 className="text-3xl font-bold">{value}</h4>
          <span className="text-xs text-zinc-600">{description}</span>
        </div>
      </div>
    </div>
  );
}
