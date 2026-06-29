import { Low } from 'lowdb';
import { YearArchiveAdapter, yearFromRecord } from './YearArchiveAdapter.js';
import { createDebouncedWriter } from './createDebouncedWriter.js';

const archiveDb = {
	db: null,
	default: {
		events: {},
		maintenance: {},
		feedingLogs: {},
		revenue: {},
		incidents: {},
		applicationLogs: {},
		healthRecords: {},
		breedingRecords: {},
		precisionLayers: {},
	},

	// Assigned in init() once the db is ready.
	write: null,
	flush: null,

	async init({ path }) {
		archiveDb.db = new Low(new YearArchiveAdapter(path), archiveDb.default);

		await archiveDb.db.read();

		archiveDb.db.data = { ...archiveDb.default, ...(archiveDb.db.data || {}) };
		// No write on init — data was just read from disk and hasn't changed.
		// Migrations call archiveDb.markAllDirty() + archiveDb.write() explicitly
		// after modifying archiveDb.db.data in place.

		const debounced = createDebouncedWriter(() => archiveDb.db.write());
		archiveDb.write = debounced.write;
		archiveDb.flush = debounced.flush;
	},

	// Mark a record's year dirty — call before archiveDb.write() whenever a
	// record is created, updated, or deleted via the CRUD layer.
	markDirty(record) {
		archiveDb.db.adapter.markDirty(yearFromRecord(record));
	},

	// Mark all currently-loaded years dirty — use after bulk in-place mutations
	// (migrations) that bypass the normal CRUD → markDirty path.
	markAllDirty() {
		archiveDb.db.adapter.markAllDirty(archiveDb.db.data);
	},
};

export default archiveDb;
