// Run with: npx tsx src/scripts/migrate-thursday-signups.ts
// Creates thursday_signups table for the Thursday signup system

import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function migrate() {
  console.log("🔧 Starting migration: create thursday_signups table...");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS thursday_signups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      UNIQUE(member_id, date, role_id)
    )
  `);
  console.log("✅ Created table: thursday_signups");

  // Verify
  const result = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='thursday_signups'"
  );
  if (result.rows.length > 0) {
    console.log("✅ Verified: thursday_signups table exists");
  } else {
    console.error("❌ Table verification failed");
    process.exit(1);
  }

  console.log("\n✅ Migration complete!");
  process.exit(0);
}

migrate().catch((e) => {
  console.error("❌ Migration failed:", e);
  process.exit(1);
});
