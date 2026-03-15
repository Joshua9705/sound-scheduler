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
  maxOverride: number | null;
  isFallback: boolean;
  preferredSlotId: number | null;
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
  const [membersRes, slotsRes, rolesRes, memberSlotsRes, memberRolesRes, slotReqsRes, configRes, thursdaySignupsRes, exclusionPairsRes] = await Promise.all([
    db.execute("SELECT * FROM members WHERE active = 1"),
    db.execute("SELECT * FROM time_slots"),
    db.execute("SELECT * FROM roles"),
    db.execute("SELECT * FROM member_slots"),
    db.execute("SELECT * FROM member_roles"),
    db.execute("SELECT * FROM slot_role_requirements"),
    db.execute("SELECT * FROM configurations"),
    db.execute("SELECT * FROM thursday_signups ORDER BY date, role_id, created_at"),
    db.execute("SELECT * FROM exclusion_pairs"),
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
    maxOverride: r.max_override !== null && r.max_override !== undefined ? Number(r.max_override) : null,
    isFallback: Number(r.is_fallback) === 1,
    preferredSlotId: r.preferred_slot_id !== null && r.preferred_slot_id !== undefined ? Number(r.preferred_slot_id) : null,
  }));

  // Build exclusion pairs: members that cannot be scheduled in the same date+slot
  const exclusionPairs: { a: number; b: number }[] = exclusionPairsRes.rows.map((r: any) => ({
    a: Number(r.member_a_id),
    b: Number(r.member_b_id),
  }));

  const isExcluded = (memberId: number, sessionMemberIds: number[]): boolean => {
    return exclusionPairs.some(
      (p) =>
        (p.a === memberId && sessionMemberIds.includes(p.b)) ||
        (p.b === memberId && sessionMemberIds.includes(p.a))
    );
  };

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

  // Track monthly assignment counts per member per slot: { "2026-04": { "memberId:slotId": count } }
  // Per-slot monthly limit: max_monthly_4week/5week applies per time_slot per member.
  // A member with 2 slots can serve up to 2×max times/month.
  const monthlySlotCount: Record<string, Record<string, number>> = {};

  for (const { year, month } of months) {
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const weeks = weeksInMonth(year, month);
    const maxPerSlotPerMonth = weeks >= 5 ? max5week : max4week;
    monthlySlotCount[monthKey] = {};

    for (const slot of slots) {
      const dates = getDatesForDayInMonth(year, month, slot.dayOfWeek);
      const reqs = slotReqs.filter((sr) => sr.slotId === slot.id);

      for (const date of dates) {
        // ── Thursday (slot_id=1): use signup-based scheduling ──
        if (slot.id === 1) {
          const sessionAssignments: Assignment[] = [];

          // For each role requirement on Thursday
          for (const req of reqs) {
            if (req.minCount === 0 && req.maxCount === 0) continue;

            // Get signups for this date and role
            const signupsForDateRole = thursdaySignupsRes.rows
              .filter((r: any) => String(r.date) === date && Number(r.role_id) === req.roleId)
              .map((r: any) => Number(r.member_id));

            if (signupsForDateRole.length > 0) {
              // Load-balance: pick the one with least assignments this month
              const ranked = signupsForDateRole
                .map((mid: number) => {
                  const count = Object.entries(monthlySlotCount[monthKey] || {})
                    .filter(([k]) => k.startsWith(`${mid}:`))
                    .reduce((sum, [, v]) => sum + (v as number), 0);
                  return { mid, count };
                })
                .sort((a: { mid: number; count: number }, b: { mid: number; count: number }) => a.count - b.count);

              // Assign up to minCount (for PA min=1)
              for (let i = 0; i < Math.min(req.minCount, ranked.length); i++) {
                sessionAssignments.push({
                  date,
                  slotId: slot.id,
                  roleId: req.roleId,
                  memberId: ranked[i].mid,
                });
              }
            } else if (req.minCount > 0) {
              // No signups: for PA (role_id=1), use fallback member
              if (req.roleId === 1) {
                const fallback = members.find((m) => m.isFallback);
                if (fallback) {
                  sessionAssignments.push({
                    date,
                    slotId: slot.id,
                    roleId: req.roleId,
                    memberId: fallback.id,
                  });
                } else {
                  warnings.push(`⚠️ ${date} 週四晚上 — PA 無人報名且找不到 fallback 成員`);
                }
              }
              // Stage (role_id=2) min=0, skip if no signups
            }
          }

          // Update monthly counts and add assignments
          for (const a of sessionAssignments) {
            const key = `${a.memberId}:${a.slotId}`;
            monthlySlotCount[monthKey][key] = (monthlySlotCount[monthKey][key] || 0) + 1;
            allAssignments.push(a);
          }

          continue; // skip normal scheduling for Thursday
        }

        // Track who is already assigned this date (across all slots on this date)
        const assignedThisDate = new Set<number>();
        for (const a of allAssignments) {
          if (a.date === date) assignedThisDate.add(a.memberId);
        }

        // Get eligible members for this slot
        const eligibleForSlot = members.filter((m) => {
          return m.slotIds.includes(slot.id);
        });

        const sessionAssignments: Assignment[] = [];
        let hasHighLevel = false;

        // Helper to check if member has hit the per-slot monthly limit
        const isWithinLimit = (member: Member): boolean => {
          if (member.isFallback) return true; // fallback members bypass normal limits
          const globalMax = maxPerSlotPerMonth;
          const memberMax = member.maxOverride !== null ? member.maxOverride : globalMax;
          const key = `${member.id}:${slot.id}`;
          const count = monthlySlotCount[monthKey][key] || 0;
          return count < memberMax;
        };

        // For each required role
        for (const req of reqs) {
          if (req.minCount === 0 && req.maxCount === 0) continue;

          // Find non-fallback regular candidates
          const regularCandidates = eligibleForSlot
            .filter((m) => !m.isFallback)
            .filter((m) => !assignedThisDate.has(m.id))
            .filter((m) => !sessionAssignments.some((a) => a.memberId === m.id))
            .filter((m) => m.roles.some((r) => r.roleId === req.roleId))
            .filter((m) => isWithinLimit(m))
            .filter((m) => !isExcluded(m.id, sessionAssignments.map((a) => a.memberId)));

          // Sort: prefer preferred slot members first, then least assigned, then by level
          regularCandidates.sort((a, b) => {
            // Preferred slot priority
            const aPref = a.preferredSlotId === slot.id ? 0 : 1;
            const bPref = b.preferredSlotId === slot.id ? 0 : 1;
            if (aPref !== bPref) return aPref - bPref;
            // Least assigned this month (across all slots)
            const aCount = Object.entries(monthlySlotCount[monthKey])
              .filter(([k]) => k.startsWith(`${a.id}:`))
              .reduce((sum, [, v]) => sum + v, 0);
            const bCount = Object.entries(monthlySlotCount[monthKey])
              .filter(([k]) => k.startsWith(`${b.id}:`))
              .reduce((sum, [, v]) => sum + v, 0);
            if (aCount !== bCount) return aCount - bCount;
            return a.level - b.level; // prefer higher level (1 > 2 > 3 > 4)
          });

          const needed = req.minCount;
          let filled = 0;

          for (const candidate of regularCandidates) {
            if (filled >= needed) break;

            const roleInfo = candidate.roles.find((r) => r.roleId === req.roleId);
            const needsPairing = candidate.level >= 3 || (roleInfo?.isLearning ?? false);

            if (needsPairing && !hasHighLevel) {
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

          // Retry: find level 1-2 first if still unfilled
          if (filled < needed) {
            const highLevelCandidates = regularCandidates.filter(
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

            if (hasHighLevel && filled < needed) {
              const lowLevelCandidates = regularCandidates.filter(
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

          // If still unfilled and slot is required, use fallback member
          if (filled < needed) {
            const fallbackMembers = eligibleForSlot.filter(
              (m) =>
                m.isFallback &&
                !assignedThisDate.has(m.id) &&
                !sessionAssignments.some((a) => a.memberId === m.id) &&
                m.roles.some((r) => r.roleId === req.roleId)
            );

            for (const fb of fallbackMembers) {
              if (filled >= needed) break;
              sessionAssignments.push({
                date,
                slotId: slot.id,
                roleId: req.roleId,
                memberId: fb.id,
              });
              filled++;
              if (fb.level <= 2) hasHighLevel = true;
            }
          }

          if (filled < needed) {
            if (slot.required) {
              warnings.push(
                `⚠️ ${date} ${slot.name} — ${rolesRes.rows.find((r: any) => Number(r.id) === req.roleId)?.name} 人力不足（需 ${needed}，僅排 ${filled}）`
              );
            }
          }
        }

        // Validate: level 3-4 members should have level 1-2 pairing
        const sessionMembers = sessionAssignments.map((a) => members.find((m) => m.id === a.memberId)!);
        const hasLow = sessionMembers.some((m) => m.level >= 3);
        const hasHigh = sessionMembers.some((m) => m.level <= 2);
        if (hasLow && !hasHigh && sessionAssignments.length > 0) {
          warnings.push(`⚠️ ${date} ${slot.name} — 等級 3-4 的成員沒有等級 1-2 搭配`);
        }

        if (!slot.required && sessionAssignments.length === 0) {
          continue;
        }

        // Update per-slot counts and add to all assignments
        for (const a of sessionAssignments) {
          const key = `${a.memberId}:${a.slotId}`;
          monthlySlotCount[monthKey][key] = (monthlySlotCount[monthKey][key] || 0) + 1;
          assignedThisDate.add(a.memberId);
          allAssignments.push(a);
        }
      }
    }
  }

  // === GUARANTEE: Every non-fallback active member gets at least 1 assignment per MONTH ===
  for (const { year, month } of months) {
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    if (!monthlySlotCount[monthKey]) monthlySlotCount[monthKey] = {};

    // Find members with 0 assignments this month
    const nonFallbackMembers = members.filter((m) => !m.isFallback);
    for (const member of nonFallbackMembers) {
      const totalThisMonth = Object.entries(monthlySlotCount[monthKey])
        .filter(([k]) => k.startsWith(`${member.id}:`))
        .reduce((sum, [, v]) => sum + v, 0);

      if (totalThisMonth > 0) continue; // already assigned this month

      let placed = false;
      for (const slot of slots) {
        if (placed) break;
        if (slot.id === 1) continue; // skip Thursday (signup-based)
        if (!member.slotIds.includes(slot.id)) continue;

        const dates = getDatesForDayInMonth(year, month, slot.dayOfWeek);
        const reqs = slotReqs.filter((sr) => sr.slotId === slot.id);

        for (const date of dates) {
          if (placed) break;
          const assignedThisDate = new Set(
            allAssignments.filter((a) => a.date === date).map((a) => a.memberId)
          );
          if (assignedThisDate.has(member.id)) continue;

          for (const req of reqs) {
            if (placed) break;
            if (req.maxCount === 0) continue;
            const memberRole = member.roles.find((r) => r.roleId === req.roleId);
            if (!memberRole) continue;

            const currentCount = allAssignments.filter(
              (a) => a.date === date && a.slotId === slot.id && a.roleId === req.roleId
            ).length;

            if (currentCount < req.maxCount) {
              // Check exclusion pairs
              const sessionMemberIds = allAssignments
                .filter((a) => a.date === date && a.slotId === slot.id)
                .map((a) => a.memberId);
              if (isExcluded(member.id, sessionMemberIds)) continue;

              const needsPairing = member.level >= 3 || memberRole.isLearning;
              if (needsPairing) {
                const sessionHasHighLevel = allAssignments
                  .filter((a) => a.date === date && a.slotId === slot.id)
                  .some((a) => {
                    const m = members.find((mm) => mm.id === a.memberId);
                    return m && m.level <= 2;
                  });
                if (!sessionHasHighLevel) continue;
              }

              allAssignments.push({
                date,
                slotId: slot.id,
                roleId: req.roleId,
                memberId: member.id,
              });
              const key = `${member.id}:${slot.id}`;
              monthlySlotCount[monthKey][key] = (monthlySlotCount[monthKey][key] || 0) + 1;
              placed = true;
            }
          }
        }
      }

      if (!placed) {
        warnings.push(`⚠️ ${monthKey} — ${member.name} 無法排入任何班次（請檢查時段與角色設定）`);
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

  // Build summary using per-slot counts
  const memberTotalCounts: Record<string, Record<number, number>> = {};
  for (const [monthKey, slotCounts] of Object.entries(monthlySlotCount)) {
    memberTotalCounts[monthKey] = {};
    for (const [key, count] of Object.entries(slotCounts)) {
      const memberId = Number(key.split(":")[0]);
      memberTotalCounts[monthKey][memberId] = (memberTotalCounts[monthKey][memberId] || 0) + count;
    }
  }

  return NextResponse.json({
    scheduleId,
    quarter,
    totalAssignments: allAssignments.length,
    warnings,
    monthSummary: Object.entries(memberTotalCounts).map(([month, counts]) => ({
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
