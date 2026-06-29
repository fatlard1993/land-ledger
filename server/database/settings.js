import { Low } from 'lowdb';
import { AtomicJSONFile } from './AtomicJSONFile.js';

const settingsDb = {
	db: null,
	default: {
		parcelServiceUrl: '',
		agAnalyticsKey: '',
		nassApiKey: '',
		importTemplates: [],
		shareTokens: [],
		apiTokens: [],
		adminPasskeyIsDefault: false,
	},
	async init({ path: dbPath }) {
		settingsDb.db = new Low(new AtomicJSONFile(dbPath), settingsDb.default);

		await settingsDb.db.read();

		settingsDb.db.data = { ...settingsDb.default, ...(settingsDb.db.data || {}) };

		await settingsDb.db.write();
	},
	get(key) {
		return settingsDb.db?.data?.[key] ?? settingsDb.default[key];
	},
	async set(key, value) {
		if (!settingsDb.db) return;

		settingsDb.db.data[key] = value;
		await settingsDb.db.write();
	},
};

export default settingsDb;
