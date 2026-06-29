import { Low } from 'lowdb';
import { AtomicJSONFile } from './AtomicJSONFile.js';

const benchmarksDb = {
	db: null,
	default: { countyYields: {} },
	_writeQueue: Promise.resolve(),
	async init({ path }) {
		benchmarksDb.db = new Low(new AtomicJSONFile(path), benchmarksDb.default);
		await benchmarksDb.db.read();
		benchmarksDb.db.data = { ...benchmarksDb.default, ...(benchmarksDb.db.data || {}) };
		await benchmarksDb.db.write();
	},
	write() {
		benchmarksDb._writeQueue = benchmarksDb._writeQueue
			.catch(() => {})
			.then(() => benchmarksDb.db.write())
			.catch(error => console.error('Benchmarks cache write failed:', error));
		return benchmarksDb._writeQueue;
	},
	get(key) {
		return benchmarksDb.db?.data?.countyYields?.[key] ?? null;
	},
	async set(key, value) {
		if (!benchmarksDb.db) return;
		benchmarksDb.db.data.countyYields[key] = { ...value, fetchedAt: new Date().toISOString() };
		await benchmarksDb.write();
	},
	flush() {
		return benchmarksDb._writeQueue;
	},
};

export default benchmarksDb;
