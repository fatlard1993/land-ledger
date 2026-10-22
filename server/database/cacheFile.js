import { Low } from 'lowdb';
import { jsonFile } from './jsonFile.js';

// A JSON file holding one map of cached answers under `key`; writes queue behind each other so two never overlap,
// and a failed write is logged without stopping the next
export const cacheFile = ({ key, label }) => {
	const cache = {
		db: null,
		_writeQueue: Promise.resolve(),
		get entries() {
			return cache.db?.data?.[key];
		},
		async init({ path }) {
			cache.db = new Low(jsonFile(path), { [key]: {} });

			await cache.db.read();

			cache.db.data = { [key]: {}, ...(cache.db.data || {}) };

			await cache.db.write();
		},
		write() {
			cache._writeQueue = cache._writeQueue
				.catch(() => {})
				.then(() => cache.db.write())
				.catch(error => console.error(`${label} cache write failed:`, error));

			return cache._writeQueue;
		},
		flush() {
			return cache._writeQueue;
		},
	};

	return cache;
};
