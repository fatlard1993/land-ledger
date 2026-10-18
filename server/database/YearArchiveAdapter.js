import { readFile, readdir } from 'fs/promises';
import { dirname, basename, join } from 'path';
import { writeJSON } from './jsonFile.js';

// ── Collections stored in the archive ─────────────────────────────────────────

const ARCHIVE_COLLECTIONS = [
	'events',
	'maintenance',
	'feedingLogs',
	'revenue',
	'incidents',
	'applicationLogs',
	'healthRecords',
	'breedingRecords',
	'precisionLayers',
];

const emptyYearData = () => Object.fromEntries(ARCHIVE_COLLECTIONS.map(c => [c, {}]));

// ── Year extraction ────────────────────────────────────────────────────────────

export function yearFromRecord(record) {
	// precisionLayers use a numeric season field directly
	if (typeof record.season === 'number' && record.season > 1900 && record.season < 2200) {
		return record.season;
	}

	const dateStr = record.date || record.breedingDate;

	if (dateStr) {
		try {
			const y = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`).getFullYear();
			if (y > 1900 && y < 2200) return y;
		} catch {}
	}

	return new Date().getFullYear();
}

// ── Split merged state into per-year buckets ───────────────────────────────────

function splitByYear(data) {
	const byYear = {};

	for (const coll of ARCHIVE_COLLECTIONS) {
		for (const [id, record] of Object.entries(data[coll] || {})) {
			const year = yearFromRecord(record);
			if (!byYear[year]) byYear[year] = emptyYearData();
			byYear[year][coll][id] = record;
		}
	}

	return byYear;
}

// ── Adapter ────────────────────────────────────────────────────────────────────

export class YearArchiveAdapter {
	_dirtyYears = new Set();

	constructor(basePath) {
		this.basePath = basePath; // e.g. ~/.landLedger-archive.json
	}

	yearPath(year) {
		return this.basePath.replace('.json', `-${year}.json`);
	}

	// Mark a single year as needing a write — called by archiveDb.markDirty(record).
	markDirty(year) {
		this._dirtyYears.add(String(year));
	}

	// Mark every currently-loaded year dirty — call after bulk in-place mutations
	// (e.g. migrations that bypass the CRUD layer).
	markAllDirty(data) {
		for (const year of Object.keys(splitByYear(data))) {
			this._dirtyYears.add(year);
		}
	}

	async read() {
		const merged = emptyYearData();

		// ── Read existing year files ────────────────────────────────────────────
		const dir = dirname(this.basePath);
		const base = basename(this.basePath, '.json');

		let files = [];
		try {
			files = await readdir(dir);
		} catch {}

		const yearFiles = files.filter(f => f.startsWith(base + '-') && /\d{4}\.json$/.test(f));

		await Promise.all(
			yearFiles.map(async file => {
				try {
					const text = await readFile(join(dir, file), 'utf-8');
					const yearData = JSON.parse(text);

					for (const coll of ARCHIVE_COLLECTIONS) {
						Object.assign(merged[coll], yearData[coll] || {});
					}
				} catch {}
			}),
		);

		return merged;
	}

	async write(data) {
		if (!this._dirtyYears.size) return;

		// Only write year files that have been marked dirty since the last write.
		// A crash after some files succeed and others don't leaves those years at
		// their new state and others at the old state — still safe, no partial-file
		// corruption, and the next mutation will re-dirty and re-write the rest.
		const byYear = splitByYear(data);
		const toWrite = [...this._dirtyYears];
		this._dirtyYears.clear();

		await Promise.all(toWrite.map(year => writeJSON(this.yearPath(year), byYear[year] ?? emptyYearData())));
	}
}
