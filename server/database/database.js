import { CollectionDB } from './CollectionDB.js';

// ── Per-collection DB instances ────────────────────────────────────────────────
// Each main-DB collection gets its own file and write queue.
// A write to fields only touches fields.json; equipment writes are independent.

export const collectionDBs = {
	fields: new CollectionDB(),
	leases: new CollectionDB(),
	loans: new CollectionDB(),
	buildings: new CollectionDB(),
	equipment: new CollectionDB(),
	paths: new CollectionDB(),
	supplies: new CollectionDB(),
	parcels: new CollectionDB(),
	maintenanceSchedules: new CollectionDB(),
	feedingSchedules: new CollectionDB(),
	budgetItems: new CollectionDB(),
	animals: new CollectionDB(),
};

// ── Manager ────────────────────────────────────────────────────────────────────

const database = {
	async init({ path }) {
		const base = path.replace('.json', '');

		await Promise.all(Object.entries(collectionDBs).map(([name, db]) => db.init(`${base}-${name}.json`)));
	},

	// Flush all pending debounced writes — call before process exit.
	async flush() {
		await Promise.all(Object.values(collectionDBs).map(db => db.flush()));
	},
};

export default database;
