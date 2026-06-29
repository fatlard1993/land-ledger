// ── Migrations ─────────────────────────────────────────────────────────────────
// Add entries here when the schema changes. Each entry runs against every record
// in the named collection on startup — safe to run repeatedly (idempotent).
//
// Main-DB collections (fields, equipment, etc.) — use collectionDBs:
//
//   import { collectionDBs } from './database.js';
//   for (const record of Object.values(collectionDBs.fields.data)) { ... }
//   await collectionDBs.fields.write();
//
// Archive collections (events, applicationLogs, etc.) — mutate archiveDb.db.data
// in place, then flush all affected years in one pass:
//
//   import archiveDb from './archive.js';
//   for (const record of Object.values(archiveDb.db.data.events)) { ... }
//   archiveDb.markAllDirty();
//   await archiveDb.write();

export async function runMigrations() {
	// No pending migrations.
}
