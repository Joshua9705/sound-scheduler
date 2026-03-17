import { db } from '../lib/db';

async function migrate() {
  try {
    await db.execute('ALTER TABLE member_roles ADD COLUMN priority INTEGER DEFAULT 0');
    console.log('Added priority column to member_roles');
  } catch (e: any) {
    if (e.message?.includes('duplicate column')) {
      console.log('Priority column already exists');
    } else {
      throw e;
    }
  }
  
  // Set default priorities based on existing order for each member
  const members = await db.execute('SELECT DISTINCT member_id FROM member_roles');
  for (const row of members.rows) {
    const roles = await db.execute({
      sql: 'SELECT role_id FROM member_roles WHERE member_id = ? ORDER BY role_id',
      args: [row.member_id as number]
    });
    for (let i = 0; i < roles.rows.length; i++) {
      await db.execute({
        sql: 'UPDATE member_roles SET priority = ? WHERE member_id = ? AND role_id = ?',
        args: [i + 1, row.member_id as number, roles.rows[i].role_id as number]
      });
    }
  }
  console.log('Set default priorities');
}

migrate().catch(console.error);
