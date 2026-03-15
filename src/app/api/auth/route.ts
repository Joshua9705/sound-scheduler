import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST: validate pin — returns role: "admin" | "scheduler"
export async function POST(req: NextRequest) {
  const { pin } = await req.json();
  if (!pin) return NextResponse.json({ error: "缺少密碼" }, { status: 400 });

  const result = await db.execute(
    "SELECT key, value FROM configurations WHERE key IN ('admin_pin', 'scheduler_pin')"
  );

  const pins: Record<string, string> = {};
  for (const row of result.rows) {
    pins[String(row.key)] = String(row.value);
  }

  if (pins.admin_pin && String(pin) === pins.admin_pin) {
    return NextResponse.json({ role: "admin" });
  }
  if (pins.scheduler_pin && String(pin) === pins.scheduler_pin) {
    return NextResponse.json({ role: "scheduler" });
  }
  return NextResponse.json({ error: "密碼錯誤" }, { status: 401 });
}

// PUT: change pin (requires old pin, admin only)
export async function PUT(req: NextRequest) {
  const { oldPin, newPin } = await req.json();
  if (!oldPin || !newPin) return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
  if (String(newPin).length < 4) return NextResponse.json({ error: "新密碼至少需 4 位" }, { status: 400 });

  const result = await db.execute(
    "SELECT value FROM configurations WHERE key = 'admin_pin' LIMIT 1"
  );
  const adminPin = result.rows[0]?.value;

  if (String(adminPin) !== String(oldPin)) {
    return NextResponse.json({ error: "舊密碼錯誤" }, { status: 401 });
  }

  await db.execute(
    "UPDATE configurations SET value = ? WHERE key = 'admin_pin'",
    [String(newPin)]
  );
  return NextResponse.json({ success: true });
}
