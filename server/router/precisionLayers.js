import { readFile, unlink } from 'fs/promises';
import { requestMatch } from '@vanilla-bean/components/app';
import { precisionLayers } from '../database';
import { writeJSON } from '../database/jsonFile.js';

import parseCSV from '../utils/parseCSV';
import { MAX_FILE_BYTES } from '../utils/limitBody.js';

// Set by server/index.js after options are parsed
let _basePath = null;
export const setPrecisionLayersPath = path => {
	_basePath = path;
};

export const layerPointsPath = id => _basePath.replace('.json', '') + `-layer-${id}.json`;

const MAX_POINTS = 5_000;

// ── Statistics ─────────────────────────────────────────────────────────────────

function computeStats(values) {
	const n = values.length;
	if (!n) return null;

	const sorted = [...values].sort((a, b) => a - b);
	const mean = values.reduce((s, v) => s + v, 0) / n;
	const stdDev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);

	return {
		count: n,
		mean: parseFloat(mean.toFixed(3)),
		stdDev: parseFloat(stdDev.toFixed(3)),
		cv: mean > 0 ? parseFloat(((stdDev / mean) * 100).toFixed(1)) : 0,
		min: sorted[0],
		max: sorted[n - 1],
		p25: sorted[Math.floor(n * 0.25)],
		p50: sorted[Math.floor(n * 0.5)],
		p75: sorted[Math.floor(n * 0.75)],
	};
}

// ── Downsampling ───────────────────────────────────────────────────────────────
// Reservoir sampling keeps a statistically representative subset when the
// input exceeds MAX_POINTS.

function downsample(points) {
	if (points.length <= MAX_POINTS) return points;

	const reservoir = points.slice(0, MAX_POINTS);

	for (let i = MAX_POINTS; i < points.length; i++) {
		const j = Math.floor(Math.random() * (i + 1));
		if (j < MAX_POINTS) reservoir[j] = points[i];
	}

	return reservoir;
}

// ── Column detection ───────────────────────────────────────────────────────────

const LAT_RE = /^(lat|latitude|northing|y)$/i;
const LNG_RE = /^(lon|long|longitude|lng|easting|x)$/i;

function detectColumns(headers) {
	return {
		latCol: headers.findIndex(h => LAT_RE.test(h.trim())),
		lngCol: headers.findIndex(h => LNG_RE.test(h.trim())),
	};
}

// ── GeoJSON point extractor ────────────────────────────────────────────────────

function extractGeoJSONPoints(geojson, valueField) {
	const singleFeature = geojson.type === 'Feature' ? [geojson] : [];
	const features = geojson.type === 'FeatureCollection' ? geojson.features : singleFeature;

	const points = [];

	for (const f of features) {
		const geom = f.geometry;
		if (!geom) continue;

		const multiCoords = geom.type === 'MultiPoint' ? geom.coordinates : null;
		const coords = geom.type === 'Point' ? [geom.coordinates] : multiCoords;

		if (!coords) continue;

		const value = valueField ? (f.properties?.[valueField] ?? null) : null;
		const numValue = value !== null && value !== '' ? parseFloat(value) : NaN;

		for (const [lng, lat] of coords) {
			if (isNaN(numValue)) continue;
			points.push({ lat: parseFloat(lat), lng: parseFloat(lng), value: numValue });
		}
	}

	return points;
}

// ── Import handler ─────────────────────────────────────────────────────────────

const handleImport = async request => {
	let formData;

	try {
		formData = await request.formData();
	} catch {
		return new Response('Expected multipart form data', { status: 400 });
	}

	const file = formData.get('file');
	const fieldId = formData.get('fieldId') || null;
	const type = formData.get('type') || 'yield';
	const valueField = formData.get('valueField') || null;
	const valueUnit = formData.get('valueUnit') || '';
	const season = formData.get('season') ? Number(formData.get('season')) : new Date().getFullYear();
	const crop = formData.get('crop') || '';
	const label = formData.get('label') || `${type === 'yield' ? 'Yield' : 'As-Applied'} ${season}`;

	if (!file) return new Response('No file provided', { status: 400 });
	if (!valueField)
		return new Response('valueField is required — specify the column containing the data values', { status: 400 });
	if (file.size > MAX_FILE_BYTES) return new Response('File too large (max 10 MB)', { status: 413 });

	const text = await file.text();
	const fileName = file.name?.toLowerCase() ?? '';

	let rawPoints = [];

	if (
		fileName.endsWith('.json') ||
		fileName.endsWith('.geojson') ||
		text.trimStart().startsWith('{') ||
		text.trimStart().startsWith('[')
	) {
		// GeoJSON path
		let geojson;

		try {
			geojson = JSON.parse(text);
		} catch {
			return new Response('Invalid JSON', { status: 400 });
		}

		rawPoints = extractGeoJSONPoints(geojson, valueField);
	} else {
		// CSV path
		const rows = parseCSV(text);
		if (rows.length < 2) return new Response('CSV has no data rows', { status: 422 });

		const headers = rows[0];
		const { latCol, lngCol } = detectColumns(headers);

		if (latCol === -1 || lngCol === -1) {
			return new Response(
				`Could not detect lat/lng columns. Found: ${headers.join(', ')}. ` +
					`Rename columns to Lat/Lon (or Latitude/Longitude).`,
				{ status: 422 },
			);
		}

		const valCol = headers.findIndex(h => h.trim().toLowerCase() === valueField.toLowerCase());

		if (valCol === -1) {
			return new Response(`Column "${valueField}" not found in CSV. Found: ${headers.join(', ')}`, { status: 422 });
		}

		for (const row of rows.slice(1)) {
			const lat = parseFloat(row[latCol]);
			const lng = parseFloat(row[lngCol]);
			const value = parseFloat(row[valCol]);

			if (isNaN(lat) || isNaN(lng) || isNaN(value)) continue;

			rawPoints.push({ lat, lng, value });
		}
	}

	if (!rawPoints.length) {
		return new Response('No valid coordinate/value points found in the file', { status: 422 });
	}

	const sampled = downsample(rawPoints);
	const stats = computeStats(sampled.map(p => p.value));

	// Create the archive record first so we have an ID for the points file.
	// Roll back the metadata record if the points write fails — otherwise the
	// layer appears in the list but 404s when its data is requested.
	let record;
	try {
		record = await precisionLayers.create({
			fieldId,
			type,
			season,
			crop,
			label,
			valueField,
			valueUnit,
			stats,
		});
		await writeJSON(layerPointsPath(record.id), { points: sampled });
	} catch (error) {
		if (record) await precisionLayers.delete({ id: record.id }).catch(() => {});
		throw error;
	}

	return Response.json({ ...record, points: sampled, originalCount: rawPoints.length }, { status: 201 });
};

// ── Column preview — parse file and return headers + sample rows ───────────────

const handlePreview = async request => {
	let formData;

	try {
		formData = await request.formData();
	} catch {
		return new Response('Expected multipart form data', { status: 400 });
	}

	const file = formData.get('file');
	if (!file) return new Response('No file provided', { status: 400 });

	const text = await file.text();
	const fileName = file.name?.toLowerCase() ?? '';

	if (fileName.endsWith('.json') || fileName.endsWith('.geojson') || text.trimStart().startsWith('{')) {
		try {
			const geojson = JSON.parse(text);
			const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
			const firstProp =
				features.find(f => f.geometry?.type === 'Point' || f.geometry?.type === 'MultiPoint')?.properties || {};
			const columns = Object.keys(firstProp);
			const sample = features
				.filter(f => f.geometry?.type === 'Point' || f.geometry?.type === 'MultiPoint')
				.slice(0, 3)
				.map(f => f.properties);

			const { latCol, lngCol } = detectColumns(columns);

			return Response.json({
				format: 'geojson',
				columns,
				sample,
				detectedLat: columns[latCol] ?? null,
				detectedLng: columns[lngCol] ?? null,
			});
		} catch {
			return new Response('Invalid JSON', { status: 400 });
		}
	}

	const rows = parseCSV(text);
	const headers = rows[0] ?? [];
	const sample = rows.slice(1, 4).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
	const { latCol, lngCol } = detectColumns(headers);

	return Response.json({
		format: 'csv',
		columns: headers,
		sample,
		detectedLat: headers[latCol] ?? null,
		detectedLng: headers[lngCol] ?? null,
		rowCount: rows.length - 1,
	});
};

// ── Router ─────────────────────────────────────────────────────────────────────

const precisionLayersRouter = async request => {
	if (requestMatch('GET', '/precision-layers', request)) return Response.json(precisionLayers.read());

	if (requestMatch('POST', '/precision-layers/import', request)) return handleImport(request);

	if (requestMatch('POST', '/precision-layers/preview', request)) return handlePreview(request);

	// Metadata only (no points)
	const getMatch = requestMatch('GET', '/precision-layers/:id', request);
	if (getMatch) {
		const item = precisionLayers.read(getMatch);
		return item ? Response.json(item) : new Response(null, { status: 404 });
	}

	// Points on demand — loaded separately from the metadata record
	const pointsMatch = requestMatch('GET', '/precision-layers/:id/points', request);
	if (pointsMatch) {
		const item = precisionLayers.read(pointsMatch);
		if (!item) return new Response(null, { status: 404 });

		try {
			const text = await readFile(layerPointsPath(pointsMatch.id), 'utf-8');
			return new Response(text, { headers: { 'Content-Type': 'application/json' } });
		} catch (e) {
			if (e.code === 'ENOENT') return new Response('Points file not found', { status: 404 });
			throw e;
		}
	}

	const deleteMatch = requestMatch('DELETE', '/precision-layers/:id', request);
	if (deleteMatch) {
		const deleted = await precisionLayers.delete(deleteMatch);
		if (!deleted) return new Response(null, { status: 404 });
		// Clean up the points file — ignore ENOENT (file may not exist for older records)
		await unlink(layerPointsPath(deleteMatch.id)).catch(e => {
			if (e.code !== 'ENOENT') throw e;
		});
		return new Response(null, { status: 204 });
	}
};

export default precisionLayersRouter;
