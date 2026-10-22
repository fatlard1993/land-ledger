import { cacheFile } from './cacheFile.js';

const benchmarksDb = Object.assign(cacheFile({ key: 'countyYields', label: 'Benchmarks' }), {
	get(key) {
		return benchmarksDb.entries?.[key] ?? null;
	},
	async set(key, value) {
		if (!benchmarksDb.db) return;

		benchmarksDb.entries[key] = { ...value, fetchedAt: new Date().toISOString() };

		await benchmarksDb.write();
	},
});

export default benchmarksDb;
