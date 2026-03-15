import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const roles = await db.execute("SELECT * FROM roles ORDER BY id ASC");
  return NextResponse.json(roles.rows);
}
