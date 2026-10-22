import { cacheFile } from './cacheFile.js';

const weatherDb = Object.assign(cacheFile({ key: 'cache', label: 'Weather' }), {
	getDay(locationKey, date) {
		return weatherDb.entries?.[locationKey]?.[date] ?? null;
	},
	async setDays(locationKey, days) {
		if (!weatherDb.db || !Object.keys(days).length) return;

		weatherDb.entries[locationKey] ??= {};

		Object.assign(weatherDb.entries[locationKey], days);

		await weatherDb.write();
	},
});

export default weatherDb;
