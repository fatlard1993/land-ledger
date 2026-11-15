import { Low } from 'lowdb';
import { jsonFile } from './jsonFile.js';

const settingsDb = {
	db: null,
	// The last write asked of the open file: one opening it again waits for it, since two lowdb instances writing one
	// file race on its temporary file, and one rename finds the other's already gone
	pending: Promise.resolve(),
	default: {
		parcelServiceUrl: '',
		agAnalyticsKey: '',
		nassApiKey: '',
		importTemplates: [],
		shareTokens: [],
		apiTokens: [],
		// Signed-in sessions by token digest: { [digest]: { id, name, roles, createdAt } }
		sessions: {},
		adminPasskeyIsDefault: false,
	},
	async init({ path: dbPath }) {
		await settingsDb.pending.catch(() => {});

		settingsDb.db = new Low(jsonFile(dbPath), settingsDb.default);

		await settingsDb.db.read();

		settingsDb.db.data = { ...settingsDb.default, ...(settingsDb.db.data || {}) };

		await settingsDb.write();
	},
	// One instance queues its own writes, so the newest one settles after every earlier one
	write() {
		settingsDb.pending = settingsDb.db.write();

		return settingsDb.pending;
	},
	get(key) {
		return settingsDb.db?.data?.[key] ?? settingsDb.default[key];
	},
	async set(key, value) {
		if (!settingsDb.db) return;

		settingsDb.db.data[key] = value;
		await settingsDb.write();
	},
};

export default settingsDb;
