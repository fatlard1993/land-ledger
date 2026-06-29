import { Low } from 'lowdb';
import { AtomicJSONFile } from './AtomicJSONFile.js';

const weatherDb = {
	db: null,
	default: { cache: {} },
	_writeQueue: Promise.resolve(),
	async init({ path }) {
		weatherDb.db = new Low(new AtomicJSONFile(path), weatherDb.default);

		await weatherDb.db.read();

		weatherDb.db.data = { ...weatherDb.default, ...(weatherDb.db.data || {}) };

		await weatherDb.db.write();
	},
	write() {
		weatherDb._writeQueue = weatherDb._writeQueue
			.catch(() => {})
			.then(() => weatherDb.db.write())
			.catch(error => console.error('Weather cache write failed:', error));

		return weatherDb._writeQueue;
	},
	getDay(locationKey, date) {
		return weatherDb.db?.data?.cache?.[locationKey]?.[date] ?? null;
	},
	async setDays(locationKey, days) {
		if (!weatherDb.db || !Object.keys(days).length) return;

		if (!weatherDb.db.data.cache[locationKey]) weatherDb.db.data.cache[locationKey] = {};

		Object.assign(weatherDb.db.data.cache[locationKey], days);

		await weatherDb.write();
	},
	flush() {
		return weatherDb._writeQueue;
	},
};

export default weatherDb;
