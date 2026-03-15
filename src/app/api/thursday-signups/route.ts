import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// Helper: get all Thursdays in a given month
function getThursdaysInMonth(year: number, month: number): string[] {
  const dates: string[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    if (d.getDay() === 4) { // 4 = Thursday
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      dates.push(`${d.getFullYear()}-${mm}-${dd}`);
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
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

// Calculate deadline: last Sunday of the 2nd month of the quarter
function calcDeadline(quarter: string): string {
  const months = quarterToMonths(quarter);
  const { year, month } = months[1]; // 2nd month
  // Find last Sunday of the month
  const lastDay = new Date(year, month, 0); // last day of month
  const dayOfWeek = lastDay.getDay(); // 0=Sun
  const daysToSubtract = dayOfWeek === 0 ? 0 : dayOfWeek;
  lastDay.setDate(lastDay.getDate() - daysToSubtract);
  const mm = String(lastDay.getMonth() + 1).padStart(2, "0");
  const dd = String(lastDay.getDate()).padStart(2, "0");
  return `${lastDay.getFullYear()}-${mm}-${dd}`;
}

// GET ?quarter=2026-Q2
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const quarter = searchParams.get("quarter");

  if (!quarter) {
    // Default to current quarter
    const now = new Date();
    const q = Math.ceil((now.getMonth() + 1) / 3);
    const defaultQuarter = `${now.getFullYear()}-Q${q}`;
    return NextResponse.redirect(new URL(`?quarter=${defaultQuarter}`, request.url));
  }

  const months = quarterToMonths(quarter);
  const allDates: string[] = [];
  for (const { year, month } of months) {
    allDates.push(...getThursdaysInMonth(year, month));
  }

  const deadline = calcDeadline(quarter);
  const today = new Date().toISOString().split("T")[0];
  const isOpen = today <= deadline;

  const [signupsRes, membersRes] = await Promise.all([
    db.execute(`
      SELECT ts.id, ts.member_id, m.name as member_name, ts.date, ts.role_id, r.name as role_name
      FROM thursday_signups ts
      JOIN members m ON m.id = ts.member_id
      JOIN roles r ON r.id = ts.role_id
      WHERE ts.date IN (${allDates.map(() => "?").join(",")})
      ORDER BY ts.date, ts.role_id, ts.created_at
    `, allDates.length > 0 ? allDates : [""]),
    db.execute("SELECT id, name FROM members WHERE active = 1 ORDER BY id"),
  ]);

  return NextResponse.json({
    quarter,
    dates: allDates,
    signups: signupsRes.rows.map((r: any) => ({
      id: Number(r.id),
      member_id: Number(r.member_id),
      member_name: String(r.member_name),
      date: String(r.date),
      role_id: Number(r.role_id),
      role_name: String(r.role_name),
    })),
    members: membersRes.rows.map((r: any) => ({
      id: Number(r.id),
      name: String(r.name),
    })),
    deadline,
    isOpen,
  });
}

// POST { member_id, date, role_id, quarter? }
export async function POST(request: Request) {
  const body = await request.json();
  const { member_id, date, role_id, quarter } = body;

  if (!member_id || !date || !role_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Validate role
  if (role_id !== 1 && role_id !== 2) {
    return NextResponse.json({ error: "role_id must be 1 (PA) or 2 (Stage)" }, { status: 400 });
  }

  // Validate date is a Thursday
  const d = new Date(date + "T00:00:00");
  if (d.getDay() !== 4) {
    return NextResponse.json({ error: "date must be a Thursday" }, { status: 400 });
  }

  // Determine quarter from date if not provided
  const effectiveQuarter = quarter || (() => {
    const month = d.getMonth() + 1;
    const q = Math.ceil(month / 3);
    return `${d.getFullYear()}-Q${q}`;
  })();

  // Check deadline
  const deadline = calcDeadline(effectiveQuarter);
  const today = new Date().toISOString().split("T")[0];
  if (today > deadline) {
    return NextResponse.json({ error: "報名已截止" }, { status: 403 });
  }

  // Validate date is in the quarter
  const months = quarterToMonths(effectiveQuarter);
  const allDates: string[] = [];
  for (const { year, month } of months) {
    allDates.push(...getThursdaysInMonth(year, month));
  }
  if (!allDates.includes(date)) {
    return NextResponse.json({ error: "date is not a Thursday in the specified quarter" }, { status: 400 });
  }

  // Validate member exists
  const memberRes = await db.execute({
    sql: "SELECT id FROM members WHERE id = ? AND active = 1",
    args: [member_id],
  });
  if (memberRes.rows.length === 0) {
    return NextResponse.json({ error: "Member not found or inactive" }, { status: 404 });
  }

  try {
    const result = await db.execute({
      sql: "INSERT INTO thursday_signups (member_id, date, role_id) VALUES (?, ?, ?)",
      args: [member_id, date, role_id],
    });
    return NextResponse.json({ id: Number(result.lastInsertRowid), success: true });
  } catch (e: any) {
    if (e.message?.includes("UNIQUE constraint")) {
      return NextResponse.json({ error: "Already signed up for this role on this date" }, { status: 409 });
    }
    throw e;
  }
}

// DELETE ?id=<signup_id>
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await db.execute({
    sql: "DELETE FROM thursday_signups WHERE id = ?",
    args: [Number(id)],
  });

  return NextResponse.json({ success: true });
}
