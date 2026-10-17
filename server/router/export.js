import { requestMatch } from '@vanilla-bean/components/app';

import { collectionDBs } from '../database/database';
import archiveDb from '../database/archive';
import settingsDb from '../database/settings';
import { requireRole } from '../auth';

// ── Collections available for each format ──────────────────────────────────────

const GEO_SOURCES = {
	fields: () => collectionDBs.fields.data,
	buildings: () => collectionDBs.buildings.data,
	parcels: () => collectionDBs.parcels.data,
	paths: () => collectionDBs.paths.data,
	equipment: () => collectionDBs.equipment.data, // lat/lng → Point geometry
};

const CSV_SOURCES = {
	events: () => archiveDb.db.data.events,
	maintenance: () => archiveDb.db.data.maintenance,
	revenue: () => archiveDb.db.data.revenue,
	incidents: () => archiveDb.db.data.incidents,
	feedingLogs: () => archiveDb.db.data.feedingLogs,
	supplies: () => collectionDBs.supplies.data,
	equipment: () => collectionDBs.equipment.data,
	leases: () => collectionDBs.leases.data,
	loans: () => collectionDBs.loans.data,
	budgetItems: () => collectionDBs.budgetItems.data,
	feedingSchedules: () => collectionDBs.feedingSchedules.data,
	applicationLogs: () => archiveDb.db.data.applicationLogs,
	animals: () => collectionDBs.animals.data,
	healthRecords: () => archiveDb.db.data.healthRecords,
	breedingRecords: () => archiveDb.db.data.breedingRecords,
};

// ── Shared helpers ─────────────────────────────────────────────────────────────

// RFC 4180 CSV cell escaping — handles nulls, objects (JSON-serialised), and quoting.
export const esc = v => {
	if (v == null) return '';
	const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
	return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const parseEventDetails = rec => (rec.details && typeof rec.details === 'object' ? rec.details : {});

// ── GeoJSON builder ────────────────────────────────────────────────────────────

// Both accept an array of record objects (call Object.values() at the call site).

export function toGeoJSON(records, collectionName) {
	const features = [];

	for (const rec of records) {
		let geometry = rec.geometry ?? null;

		// Equipment: synthesise a Point from lat/lng
		if (!geometry && rec.lat != null && rec.lng != null) {
			geometry = { type: 'Point', coordinates: [Number(rec.lng), Number(rec.lat)] };
		}

		if (!geometry) continue;

		// Strip geometry and location scalars (encoded in geometry already) from properties.
		// Merge the user's free-form properties bag in directly.
		const { geometry: _geom, lat: _lat, lng: _lng, properties: propBag, ...rest } = rec;
		const properties = {
			_collection: collectionName,
			...rest,
			...(propBag && typeof propBag === 'object' ? propBag : {}),
		};

		features.push({ type: 'Feature', geometry, properties });
	}

	return { type: 'FeatureCollection', features };
}

// ── CSV builder ────────────────────────────────────────────────────────────────

export function toCSV(rows) {
	if (!rows.length) return 'id\n';

	// Collect columns in stable order: id first, scalars, then prop:*, then detail:*
	const scalarCols = new Set(['id']);
	const propCols = new Set();
	const detailCols = new Set();

	for (const rec of rows) {
		for (const key of Object.keys(rec)) {
			if (key === 'id' || key === 'geometry' || key === 'properties' || key === 'details') continue;
			scalarCols.add(key);
		}
		if (rec.properties && typeof rec.properties === 'object') {
			for (const key of Object.keys(rec.properties)) propCols.add(key);
		}
		for (const key of Object.keys(parseEventDetails(rec))) detailCols.add(key);
	}

	const allCols = [...scalarCols, ...[...propCols].map(k => `prop:${k}`), ...[...detailCols].map(k => `detail:${k}`)];

	const lines = [allCols.join(',')];

	for (const rec of rows) {
		const details = parseEventDetails(rec);
		lines.push(
			allCols
				.map(col => {
					if (col.startsWith('prop:')) return esc(rec.properties?.[col.slice(5)]);
					if (col.startsWith('detail:')) return esc(details[col.slice(7)]);
					return esc(rec[col]);
				})
				.join(','),
		);
	}

	return lines.join('\n');
}

// ── Template-driven CSV builder ────────────────────────────────────────────────
// Inverts a saved import mapping (csvCol → field) to produce a CSV that can
// be re-imported using the same template without any remapping.

export function toCSVWithTemplate(rows, mapping) {
	const columns = Object.entries(mapping)
		.filter(([, field]) => field !== '_skip')
		.map(([csvName, field]) => ({ csvName, field }));

	const header = columns.map(c => esc(c.csvName)).join(',');

	const dataRows = rows.map(rec =>
		columns
			.map(({ csvName, field }) => (field === '_properties' ? esc(rec.properties?.[csvName]) : esc(rec[field])))
			.join(','),
	);

	return [header, ...dataRows].join('\n');
}

// ── Date stamp helper ──────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10);

// ── Router ─────────────────────────────────────────────────────────────────────

const exportRouter = async request => {
	// ── GeoJSON export ────────────────────────────────────────────────────────
	const geoMatch = requestMatch('GET', '/export/geojson', request);

	if (geoMatch) {
		const type = geoMatch.type || 'all';

		let geojson;

		if (type === 'all') {
			const features = [];

			for (const [name, src] of Object.entries(GEO_SOURCES)) {
				toGeoJSON(Object.values(src()), name).features.forEach(f => features.push(f));
			}

			geojson = { type: 'FeatureCollection', features };
		} else if (GEO_SOURCES[type]) {
			geojson = toGeoJSON(Object.values(GEO_SOURCES[type]()), type);
		} else {
			return new Response(`Unknown type: ${type}. Valid: ${Object.keys(GEO_SOURCES).join(', ')}, all`, { status: 400 });
		}

		const filename = `land-ledger-${type}-${today()}.geojson`;

		return new Response(JSON.stringify(geojson, null, 2), {
			headers: {
				'Content-Type': 'application/geo+json; charset=utf-8',
				'Content-Disposition': `attachment; filename="${filename}"`,
			},
		});
	}

	// ── Template CSV export ───────────────────────────────────────────────────
	// Generates a CSV whose columns match a saved import template — making the
	// export→edit→reimport cycle seamless for recurring structured files.
	const templateMatch = requestMatch('GET', '/export/csv/template', request);

	if (templateMatch) {
		const name = decodeURIComponent(templateMatch.name || '');
		const templates = settingsDb.get('importTemplates') ?? [];
		const template = templates.find(t => t.name === name);

		if (!template) return new Response(`Template not found: ${name}`, { status: 404 });

		const source = CSV_SOURCES[template.collection];

		if (!source) return new Response(`Unknown collection: ${template.collection}`, { status: 400 });

		const csv = toCSVWithTemplate(Object.values(source()), template.mapping);
		const slug = name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
		const filename = `land-ledger-${slug}-${today()}.csv`;

		return new Response(csv, {
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="${filename}"`,
			},
		});
	}

	// ── CSV export ────────────────────────────────────────────────────────────
	const csvMatch = requestMatch('GET', '/export/csv', request);

	if (csvMatch) {
		const collection = csvMatch.collection;

		if (!collection || !CSV_SOURCES[collection]) {
			return new Response(`Unknown collection: ${collection}. Valid: ${Object.keys(CSV_SOURCES).join(', ')}`, {
				status: 400,
			});
		}

		const csv = toCSV(Object.values(CSV_SOURCES[collection]()));
		const filename = `land-ledger-${collection}-${today()}.csv`;

		return new Response(csv, {
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="${filename}"`,
			},
		});
	}

	// ── Full JSON backup ───────────────────────────────────────────────────────
	const jsonMatch = requestMatch('GET', '/export/json', request);

	if (jsonMatch) {
		const guard = requireRole(request, ['admin', 'financials']);
		if (guard) return guard;

		const backup = {
			exportedAt: new Date().toISOString(),
			main: Object.fromEntries(Object.entries(collectionDBs).map(([name, db]) => [name, db.data])),
			archive: archiveDb.db.data,
		};

		const filename = `land-ledger-backup-${today()}.json`;

		return new Response(JSON.stringify(backup, null, 2), {
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Content-Disposition': `attachment; filename="${filename}"`,
			},
		});
	}
};

export default exportRouter;
