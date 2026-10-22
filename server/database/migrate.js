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

import archiveDb from './archive.js';

export async function runMigrations() {
	await numericSeasons();
}

// Events created through the API or a CSV import before season was typed hold it as text ("2026")
async function numericSeasons() {
	let changed = false;

	for (const event of Object.values(archiveDb.db.data.events)) {
		if (typeof event.season !== 'string' || event.season.trim() === '' || !Number.isFinite(Number(event.season)))
			continue;

		event.season = Number(event.season);
		changed = true;
	}

	if (!changed) return;

	archiveDb.markAllDirty();
	await archiveDb.write();
}
