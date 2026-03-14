import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const members = await db.execute(`
    SELECT m.*, 
           GROUP_CONCAT(DISTINCT ts.id) as slot_ids,
           GROUP_CONCAT(DISTINCT ts.name) as slot_names,
           GROUP_CONCAT(DISTINCT r.id || ':' || r.name || ':' || mr.is_learning) as role_info
    FROM members m
    LEFT JOIN member_slots ms ON m.id = ms.member_id
    LEFT JOIN time_slots ts ON ms.slot_id = ts.id
    LEFT JOIN member_roles mr ON m.id = mr.member_id
    LEFT JOIN roles r ON mr.role_id = r.id
    GROUP BY m.id
    ORDER BY m.level ASC, m.name ASC
  `);
  return NextResponse.json(members.rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, level, slot_ids, roles } = body;
  
  const result = await db.execute({
    sql: "INSERT INTO members (name, level) VALUES (?, ?)",
    args: [name, level],
  });
  const memberId = result.lastInsertRowid;

  const stmts: any[] = [];
  if (slot_ids?.length) {
    for (const slotId of slot_ids) {
      stmts.push({ sql: "INSERT INTO member_slots (member_id, slot_id) VALUES (?, ?)", args: [memberId, slotId] });
    }
  }
  if (roles?.length) {
    for (const r of roles) {
      stmts.push({ sql: "INSERT INTO member_roles (member_id, role_id, is_learning) VALUES (?, ?, ?)", args: [memberId, r.role_id, r.is_learning ? 1 : 0] });
    }
  }
  if (stmts.length) await db.batch(stmts, "write");

  return NextResponse.json({ id: Number(memberId) }, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { id, name, level, active, slot_ids, roles } = body;

  const stmts: any[] = [
    { sql: "UPDATE members SET name = ?, level = ?, active = ? WHERE id = ?", args: [name, level, active ? 1 : 0, id] },
    { sql: "DELETE FROM member_slots WHERE member_id = ?", args: [id] },
    { sql: "DELETE FROM member_roles WHERE member_id = ?", args: [id] },
  ];
  if (slot_ids?.length) {
    for (const slotId of slot_ids) {
      stmts.push({ sql: "INSERT INTO member_slots (member_id, slot_id) VALUES (?, ?)", args: [id, slotId] });
    }
  }
  if (roles?.length) {
    for (const r of roles) {
      stmts.push({ sql: "INSERT INTO member_roles (member_id, role_id, is_learning) VALUES (?, ?, ?)", args: [id, r.role_id, r.is_learning ? 1 : 0] });
    }
  }
  await db.batch(stmts, "write");
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  
  await db.batch([
    { sql: "DELETE FROM member_slots WHERE member_id = ?", args: [id] },
    { sql: "DELETE FROM member_roles WHERE member_id = ?", args: [id] },
    { sql: "DELETE FROM assignments WHERE member_id = ?", args: [id] },
    { sql: "DELETE FROM members WHERE id = ?", args: [id] },
  ], "write");
  return NextResponse.json({ ok: true });
}
