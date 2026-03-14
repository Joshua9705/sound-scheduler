import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const quarter = searchParams.get("quarter");
  
  if (!quarter) {
    const schedules = await db.execute("SELECT * FROM schedules ORDER BY quarter DESC");
    return NextResponse.json(schedules.rows);
  }

  const schedule = await db.execute({ sql: "SELECT * FROM schedules WHERE quarter = ?", args: [quarter] });
  if (!schedule.rows.length) return NextResponse.json({ schedule: null, assignments: [] });

  const sid = schedule.rows[0].id;
  const assignments = await db.execute({
    sql: `SELECT a.*, m.name as member_name, m.level as member_level,
                 r.name as role_name, ts.name as slot_name, ts.day_of_week
          FROM assignments a
          JOIN members m ON a.member_id = m.id
          JOIN roles r ON a.role_id = r.id
          JOIN time_slots ts ON a.slot_id = ts.id
          WHERE a.schedule_id = ?
          ORDER BY a.date ASC, a.slot_id ASC, a.role_id ASC`,
    args: [sid],
  });

  return NextResponse.json({ schedule: schedule.rows[0], assignments: assignments.rows });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { assignment_id, member_id } = body;
  
  await db.execute({
    sql: "UPDATE assignments SET member_id = ? WHERE id = ?",
    args: [member_id, assignment_id],
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const quarter = searchParams.get("quarter");
  if (!quarter) return NextResponse.json({ error: "Missing quarter" }, { status: 400 });

  const schedule = await db.execute({ sql: "SELECT id FROM schedules WHERE quarter = ?", args: [quarter] });
  if (schedule.rows.length) {
    await db.batch([
      { sql: "DELETE FROM assignments WHERE schedule_id = ?", args: [schedule.rows[0].id] },
      { sql: "DELETE FROM schedules WHERE id = ?", args: [schedule.rows[0].id] },
    ], "write");
  }
  return NextResponse.json({ ok: true });
}
