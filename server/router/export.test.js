import { describe, test, expect } from 'bun:test';

import { esc, toCSV, toGeoJSON, toCSVWithTemplate } from './export.js';

// ── esc (CSV) ──────────────────────────────────────────────────────────────────

describe('esc', () => {
	test('returns empty string for null/undefined', () => {
		expect(esc(null)).toBe('');
		expect(esc(undefined)).toBe('');
	});

	test('passes through plain strings unchanged', () => {
		expect(esc('Whitman County')).toBe('Whitman County');
	});

	test('quotes strings that contain a comma', () => {
		expect(esc('wheat, corn')).toBe('"wheat, corn"');
	});

	test('quotes strings that contain a double-quote and escapes it', () => {
		expect(esc('say "hi"')).toBe('"say ""hi"""');
	});

	test('quotes strings that contain a newline', () => {
		expect(esc('line1\nline2')).toBe('"line1\nline2"');
	});

	test('serialises objects as quoted RFC-4180 JSON (interior quotes doubled)', () => {
		// { a: 1 } → JSON → {"a":1} → contains " → RFC 4180 quoting → "{""a"":1}"
		expect(esc({ a: 1 })).toBe('"{""a"":1}"');
	});
});

// ── toGeoJSON ─────────────────────────────────────────────────────────────────

describe('toGeoJSON', () => {
	const poly = {
		type: 'Polygon',
		coordinates: [
			[
				[0, 0],
				[1, 0],
				[1, 1],
				[0, 0],
			],
		],
	};

	test('wraps records in a FeatureCollection', () => {
		const result = toGeoJSON([{ id: 'f1', name: 'North', geometry: poly }], 'fields');
		expect(result.type).toBe('FeatureCollection');
		expect(result.features).toHaveLength(1);
	});

	test('includes _collection property on each feature', () => {
		const result = toGeoJSON([{ id: 'f1', name: 'North', geometry: poly }], 'fields');
		expect(result.features[0].properties._collection).toBe('fields');
	});

	test('strips the geometry key from properties', () => {
		const result = toGeoJSON([{ id: 'f1', geometry: poly }], 'fields');
		expect(result.features[0].properties.geometry).toBeUndefined();
	});

	test('skips records with no geometry and no lat/lng', () => {
		const result = toGeoJSON([{ id: 'f1', name: 'No geometry' }], 'fields');
		expect(result.features).toHaveLength(0);
	});

	test('synthesises a Point geometry from lat/lng for equipment', () => {
		const result = toGeoJSON([{ id: 'e1', lat: 46.5, lng: -117.2 }], 'equipment');
		expect(result.features[0].geometry.type).toBe('Point');
		expect(result.features[0].geometry.coordinates).toEqual([-117.2, 46.5]);
	});

	test('merges the free-form properties bag into the feature properties', () => {
		const rec = { id: 'f1', geometry: poly, properties: { custom: 'yes' } };
		const result = toGeoJSON([rec], 'fields');
		expect(result.features[0].properties.custom).toBe('yes');
		expect(result.features[0].properties.properties).toBeUndefined();
	});
});

// ── toCSV ─────────────────────────────────────────────────────────────────────

describe('toCSV', () => {
	test('returns a header-only row for an empty array', () => {
		expect(toCSV([])).toBe('id\n');
	});

	test('includes all scalar columns in the header', () => {
		const rows = [{ id: 'a1', name: 'Field A', acreage: 42 }];
		const csv = toCSV(rows);
		const header = csv.split('\n')[0];

		expect(header).toContain('id');
		expect(header).toContain('name');
		expect(header).toContain('acreage');
	});

	test('id column is always first', () => {
		const rows = [{ id: 'a1', name: 'Field A' }];
		const header = toCSV(rows).split('\n')[0].split(',');

		expect(header[0]).toBe('id');
	});

	test('flattens properties bag into prop: prefixed columns', () => {
		const rows = [{ id: 'a1', properties: { lab: 'SOIL_LAB' } }];
		const header = toCSV(rows).split('\n')[0];

		expect(header).toContain('prop:lab');
	});

	test('escapes commas in field values', () => {
		const rows = [{ id: 'a1', name: 'North, South' }];
		const data = toCSV(rows).split('\n')[1];

		expect(data).toContain('"North, South"');
	});

	test('produces one data row per record', () => {
		const rows = [
			{ id: 'a1', name: 'A' },
			{ id: 'a2', name: 'B' },
		];
		const lines = toCSV(rows).split('\n').filter(Boolean);

		expect(lines).toHaveLength(3); // header + 2 data rows
	});
});

// ── toCSVWithTemplate ─────────────────────────────────────────────────────────

describe('toCSVWithTemplate', () => {
	const mapping = { 'Field Name': 'name', Acres: 'acreage', 'Skip Me': '_skip' };

	test('uses mapping keys as CSV column names', () => {
		const csv = toCSVWithTemplate([{ id: 'a1', name: 'North', acreage: 100 }], mapping);
		const header = csv.split('\n')[0];

		expect(header).toContain('Field Name');
		expect(header).toContain('Acres');
	});

	test('omits columns mapped to _skip', () => {
		const csv = toCSVWithTemplate([{ id: 'a1', name: 'North', acreage: 100 }], mapping);
		const header = csv.split('\n')[0];

		expect(header).not.toContain('Skip Me');
	});

	test('maps record fields to the correct columns', () => {
		const csv = toCSVWithTemplate([{ id: 'a1', name: 'North', acreage: 100 }], mapping);
		const row = csv.split('\n')[1].split(',');
		const header = csv.split('\n')[0].split(',');

		const nameIdx = header.indexOf('Field Name');

		expect(row[nameIdx]).toBe('North');
	});
});
