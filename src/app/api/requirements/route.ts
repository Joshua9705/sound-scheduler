import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const reqs = await db.execute(
    `SELECT r.slot_id, r.role_id, r.min_count, r.max_count,
            ts.name as slot_name, ro.name as role_name
     FROM slot_role_requirements r
     JOIN time_slots ts ON r.slot_id = ts.id
     JOIN roles ro ON r.role_id = ro.id
     ORDER BY r.slot_id, r.role_id`
  );
  return NextResponse.json(reqs.rows);
}

export async function PATCH(request: Request) {
  const { slot_id, role_id, min_count, max_count } = await request.json();
  if (slot_id == null || role_id == null || min_count == null || max_count == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (Number(max_count) < Number(min_count)) {
    return NextResponse.json({ error: "max_count must be >= min_count" }, { status: 400 });
  }
  await db.execute({
    sql: `INSERT INTO slot_role_requirements (slot_id, role_id, min_count, max_count)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(slot_id, role_id) DO UPDATE SET min_count = excluded.min_count, max_count = excluded.max_count`,
    args: [slot_id, role_id, min_count, max_count],
  });
  return NextResponse.json({ ok: true });
}
