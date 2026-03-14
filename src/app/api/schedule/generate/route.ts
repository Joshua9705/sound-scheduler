import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// Helper: get all dates for a day_of_week in a given month (0=Sun, 4=Thu, 6=Sat)
function getDatesForDayInMonth(year: number, month: number, dayOfWeek: number): string[] {
  const dates: string[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    if (d.getDay() === dayOfWeek) {
      dates.push(d.toISOString().split("T")[0]);
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// Helper: count weeks in a month
function weeksInMonth(year: number, month: number): number {
  // Count Sundays as week marker
  const sundays = getDatesForDayInMonth(year, month, 0);
  return sundays.length >= 5 ? 5 : 4;
}

// Parse quarter string "2026-Q2" -> [{year, month}]
function quarterToMonths(quarter: string): { year: number; month: number }[] {
  const [yearStr, qStr] = quarter.split("-Q");
  const year = parseInt(yearStr);
  const q = parseInt(qStr);
  const startMonth = (q - 1) * 3 + 1;
  return [
    { year, month: startMonth },
    { year, month: startMonth + 1 },
    { year, month: startMonth + 2 },
  ];
}

interface Member {
  id: number;
  name: string;
  level: number;
  slotIds: number[];
  roles: { roleId: number; isLearning: boolean }[];
}

interface SlotReq {
  slotId: number;
  roleId: number;
  minCount: number;
  maxCount: number;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { quarter } = body;
  if (!quarter) return NextResponse.json({ error: "Missing quarter" }, { status: 400 });

  // Check if schedule already exists
  const existing = await db.execute({ sql: "SELECT id FROM schedules WHERE quarter = ?", args: [quarter] });
  if (existing.rows.length) {
    return NextResponse.json({ error: `班表 ${quarter} 已存在，請先刪除再重新產出` }, { status: 409 });
  }

  // Load all data
  const [membersRes, slotsRes, rolesRes, memberSlotsRes, memberRolesRes, slotReqsRes, configRes] = await Promise.all([
    db.execute("SELECT * FROM members WHERE active = 1"),
    db.execute("SELECT * FROM time_slots"),
    db.execute("SELECT * FROM roles"),
    db.execute("SELECT * FROM member_slots"),
    db.execute("SELECT * FROM member_roles"),
    db.execute("SELECT * FROM slot_role_requirements"),
    db.execute("SELECT * FROM configurations"),
  ]);

  const config: Record<string, string> = {};
  for (const r of configRes.rows) config[String(r.key)] = String(r.value);
  const max4week = parseInt(config.max_monthly_4week || "2");
  const max5week = parseInt(config.max_monthly_5week || "3");

  // Build member objects
  const members: Member[] = membersRes.rows.map((r: any) => ({
    id: Number(r.id),
    name: String(r.name),
    level: Number(r.level),
    slotIds: memberSlotsRes.rows
      .filter((ms: any) => Number(ms.member_id) === Number(r.id))
      .map((ms: any) => Number(ms.slot_id)),
    roles: memberRolesRes.rows
      .filter((mr: any) => Number(mr.member_id) === Number(r.id))
      .map((mr: any) => ({ roleId: Number(mr.role_id), isLearning: Number(mr.is_learning) === 1 })),
  }));

  const slots = slotsRes.rows.map((r: any) => ({
    id: Number(r.id),
    name: String(r.name),
    dayOfWeek: Number(r.day_of_week),
    required: Number(r.required) === 1,
  }));

  const slotReqs: SlotReq[] = slotReqsRes.rows.map((r: any) => ({
    slotId: Number(r.slot_id),
    roleId: Number(r.role_id),
    minCount: Number(r.min_count),
    maxCount: Number(r.max_count),
  }));

  // Generate dates for each slot in the quarter
  const months = quarterToMonths(quarter);
  const warnings: string[] = [];

  interface Assignment {
    date: string;
    slotId: number;
    roleId: number;
    memberId: number;
  }
  const allAssignments: Assignment[] = [];

  // Track monthly assignment counts per member: { "2026-04": { memberId: count } }
  const monthlyCount: Record<string, Record<number, number>> = {};

  for (const { year, month } of months) {
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const weeks = weeksInMonth(year, month);
    const maxPerMonth = weeks >= 5 ? max5week : max4week;
    monthlyCount[monthKey] = {};

    for (const slot of slots) {
      const dates = getDatesForDayInMonth(year, month, slot.dayOfWeek);
      const reqs = slotReqs.filter((sr) => sr.slotId === slot.id);

      for (const date of dates) {
        // Track who is already assigned this date (across all slots on this date)
        const assignedThisDate = new Set<number>();
        for (const a of allAssignments) {
          if (a.date === date) assignedThisDate.add(a.memberId);
        }

        // Get eligible members for this slot
        const eligibleForSlot = members.filter(
          (m) => m.slotIds.includes(slot.id) || m.slotIds.includes(1) // slot 1 = Thursday (all members can do Thursday per spec... actually check: "週四全部人都可以填寫報名")
        ).filter((m) => {
          // Actually re-check: for Thursday (slot 1), all members can participate
          if (slot.id === 1) return true;
          return m.slotIds.includes(slot.id);
        });

        const sessionAssignments: Assignment[] = [];
        let hasHighLevel = false; // Track if level 1-2 is in this session

        // For each required role
        for (const req of reqs) {
          if (req.minCount === 0 && req.maxCount === 0) continue;

          // Find members who can fill this role in this slot
          const candidates = eligibleForSlot
            .filter((m) => !assignedThisDate.has(m.id)) // not already assigned today
            .filter((m) => !sessionAssignments.some((a) => a.memberId === m.id)) // not in this session
            .filter((m) => m.roles.some((r) => r.roleId === req.roleId)) // can do this role
            .filter((m) => {
              // Check monthly limit
              const count = monthlyCount[monthKey][m.id] || 0;
              return count < maxPerMonth;
            });

          // Sort: prefer least assigned this month, then by level (prefer higher level = lower number)
          candidates.sort((a, b) => {
            const aCount = monthlyCount[monthKey][a.id] || 0;
            const bCount = monthlyCount[monthKey][b.id] || 0;
            if (aCount !== bCount) return aCount - bCount;
            return a.level - b.level; // prefer higher level (1 > 2 > 3 > 4)
          });

          // For min_count roles, we must fill them
          const needed = req.minCount;
          let filled = 0;

          for (const candidate of candidates) {
            if (filled >= needed) break;

            // If candidate is level 3-4 or learning this role, check pairing
            const roleInfo = candidate.roles.find((r) => r.roleId === req.roleId);
            const needsPairing = candidate.level >= 3 || (roleInfo?.isLearning ?? false);

            if (needsPairing && !hasHighLevel) {
              // Skip for now, try to assign level 1-2 first
              continue;
            }

            sessionAssignments.push({
              date,
              slotId: slot.id,
              roleId: req.roleId,
              memberId: candidate.id,
            });
            filled++;
            if (candidate.level <= 2) hasHighLevel = true;
          }

          // If we couldn't fill because we need level 1-2 first, retry with level 1-2
          if (filled < needed) {
            // Find level 1-2 candidates first
            const highLevelCandidates = candidates.filter(
              (m) => m.level <= 2 && !sessionAssignments.some((a) => a.memberId === m.id)
            );
            for (const hc of highLevelCandidates) {
              if (filled >= needed) break;
              sessionAssignments.push({
                date,
                slotId: slot.id,
                roleId: req.roleId,
                memberId: hc.id,
              });
              filled++;
              hasHighLevel = true;
            }

            // Now retry low-level candidates
            if (hasHighLevel && filled < needed) {
              const lowLevelCandidates = candidates.filter(
                (m) => m.level >= 3 && !sessionAssignments.some((a) => a.memberId === m.id)
              );
              for (const lc of lowLevelCandidates) {
                if (filled >= needed) break;
                sessionAssignments.push({
                  date,
                  slotId: slot.id,
                  roleId: req.roleId,
                  memberId: lc.id,
                });
                filled++;
              }
            }
          }

          if (filled < needed) {
            if (slot.required) {
              warnings.push(`⚠️ ${date} ${slot.name} — ${rolesRes.rows.find((r: any) => Number(r.id) === req.roleId)?.name} 人力不足（需 ${needed}，僅排 ${filled}）`);
            }
          }
        }

        // Validate: if session has level 3-4 members, must have level 1-2
        const sessionMembers = sessionAssignments.map((a) => members.find((m) => m.id === a.memberId)!);
        const hasLow = sessionMembers.some((m) => m.level >= 3);
        const hasHigh = sessionMembers.some((m) => m.level <= 2);
        if (hasLow && !hasHigh && sessionAssignments.length > 0) {
          warnings.push(`⚠️ ${date} ${slot.name} — 等級 3-4 的成員沒有等級 1-2 搭配`);
        }

        // If Thursday and no assignments, that's ok (can be empty)
        if (!slot.required && sessionAssignments.length === 0) {
          continue;
        }

        // Update counts and add to all assignments
        for (const a of sessionAssignments) {
          monthlyCount[monthKey][a.memberId] = (monthlyCount[monthKey][a.memberId] || 0) + 1;
          assignedThisDate.add(a.memberId);
          allAssignments.push(a);
        }
      }
    }
  }

  // Save to database
  const scheduleResult = await db.execute({
    sql: "INSERT INTO schedules (quarter, status) VALUES (?, 'draft')",
    args: [quarter],
  });
  const scheduleId = Number(scheduleResult.lastInsertRowid);

  if (allAssignments.length > 0) {
    await db.batch(
      allAssignments.map((a) => ({
        sql: "INSERT INTO assignments (schedule_id, date, slot_id, role_id, member_id) VALUES (?, ?, ?, ?, ?)",
        args: [scheduleId, a.date, a.slotId, a.roleId, a.memberId],
      })),
      "write"
    );
  }

  return NextResponse.json({
    scheduleId,
    quarter,
    totalAssignments: allAssignments.length,
    warnings,
    monthSummary: Object.entries(monthlyCount).map(([month, counts]) => ({
      month,
      members: Object.entries(counts)
        .map(([mid, count]) => ({
          memberId: Number(mid),
          name: members.find((m) => m.id === Number(mid))?.name || "?",
          count,
        }))
        .sort((a, b) => b.count - a.count),
    })),
  });
}
