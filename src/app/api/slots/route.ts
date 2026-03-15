import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const slots = await db.execute("SELECT * FROM time_slots ORDER BY id ASC");
  return NextResponse.json(slots.rows);
}
