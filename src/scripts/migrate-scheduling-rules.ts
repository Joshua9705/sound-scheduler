// Run with: npx tsx src/scripts/migrate-scheduling-rules.ts
// Adds scheduling rule columns to support per-member constraints

import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function migrate() {
  console.log("🔧 Starting migration: add per-member scheduling rule columns...");

  // Add new columns to members table
  const alterStatements = [
    "ALTER TABLE members ADD COLUMN max_override INTEGER DEFAULT NULL",
    "ALTER TABLE members ADD COLUMN is_fallback INTEGER DEFAULT 0",
    "ALTER TABLE members ADD COLUMN preferred_slot_id INTEGER DEFAULT NULL",
  ];

  for (const sql of alterStatements) {
    try {
      await db.execute(sql);
      console.log(`✅ Executed: ${sql}`);
    } catch (e: any) {
      if (e.message?.includes("duplicate column") || e.message?.includes("already exists")) {
        console.log(`⏭️  Column already exists, skipping: ${sql}`);
      } else {
        throw e;
      }
    }
  }

  // Update specific members
  console.log("\n🔧 Updating specific member records...");

  // Member id=1 (Member_A): Set is_fallback=1, max_override=NULL (no limit)
  await db.execute({
    sql: "UPDATE members SET is_fallback = 1, max_override = NULL WHERE id = 1",
    args: [],
  });
  console.log("✅ Member id=1 (Member_A): set is_fallback=1, max_override=NULL");

  // Member id=2 (Member_B): Set preferred_slot_id=3 (週日早上)
  await db.execute({
    sql: "UPDATE members SET preferred_slot_id = 3 WHERE id = 2",
    args: [],
  });
  console.log("✅ Member id=2 (Member_B): set preferred_slot_id=3 (週日早上)");

  // Verify the changes
  const members = await db.execute(
    "SELECT id, name, max_override, is_fallback, preferred_slot_id FROM members ORDER BY id"
  );
  console.log("\n📋 Current members table state:");
  for (const row of members.rows) {
    console.log(
      `  id=${row.id} ${row.name}: max_override=${row.max_override}, is_fallback=${row.is_fallback}, preferred_slot_id=${row.preferred_slot_id}`
    );
  }

  console.log("\n✅ Migration complete!");
  process.exit(0);
}

migrate().catch((e) => {
  console.error("❌ Migration failed:", e);
  process.exit(1);
});
