import { describe, test, expect } from 'bun:test';

import { geodesicAreaSqm, convertArea, formatArea, pointInPolygon, centroidFromGeometry } from './geo.js';

// A 1° × 1° box near the equator — lat/lon both span 0→1. GeoJSON coords are [lon, lat].
const UNIT_SQUARE = {
	type: 'Polygon',
	coordinates: [
		[
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 1],
			[0, 0],
		],
	],
};

// Same box with a 0.5° × 0.5° hole in the centre
const SQUARE_WITH_HOLE = {
	type: 'Polygon',
	coordinates: [
		[
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 1],
			[0, 0],
		],
		[
			[0.25, 0.25],
			[0.75, 0.25],
			[0.75, 0.75],
			[0.25, 0.75],
			[0.25, 0.25],
		],
	],
};

describe('geodesicAreaSqm', () => {
	test('returns 0 for null geometry', () => {
		expect(geodesicAreaSqm(null)).toBe(0);
	});

	test('returns a positive area for a valid polygon', () => {
		expect(geodesicAreaSqm(UNIT_SQUARE)).toBeGreaterThan(0);
	});

	test('polygon with a hole reports less area than without', () => {
		expect(geodesicAreaSqm(SQUARE_WITH_HOLE)).toBeLessThan(geodesicAreaSqm(UNIT_SQUARE));
	});

	test('MultiPolygon area is larger than one of its constituent polygons', () => {
		const multi = {
			type: 'MultiPolygon',
			coordinates: [
				UNIT_SQUARE.coordinates,
				[
					[
						[2, 0],
						[3, 0],
						[3, 1],
						[2, 1],
						[2, 0],
					],
				],
			],
		};

		expect(geodesicAreaSqm(multi)).toBeGreaterThan(geodesicAreaSqm(UNIT_SQUARE));
	});
});

describe('convertArea', () => {
	test('converts sqm to acres', () => {
		expect(convertArea(4046.86, 'ac')).toBeCloseTo(1.0, 0);
	});

	test('converts sqm to hectares', () => {
		expect(convertArea(10_000, 'ha')).toBe(1);
	});

	test('converts sqm to square feet (rounded to 0 decimals)', () => {
		// convertArea rounds sqft to 0 decimal places — 10.7639 → 11
		expect(convertArea(1, 'sqft')).toBe(11);
	});

	test('returns 0 for zero input', () => {
		expect(convertArea(0, 'ac')).toBe(0);
	});

	test('returns 0 for null input', () => {
		expect(convertArea(null, 'ac')).toBe(0);
	});
});

describe('formatArea', () => {
	test('returns empty string for null', () => {
		expect(formatArea(null)).toBe('');
	});

	test('returns empty string for empty string', () => {
		expect(formatArea('')).toBe('');
	});

	test('formats acres to one decimal place', () => {
		expect(formatArea(10.1, 'ac')).toBe('10.1 ac');
	});

	test('formats hectares to two decimal places', () => {
		expect(formatArea(10, 'ha')).toBe('10.00 ha');
	});

	test('formats square feet with locale comma separator and no decimals', () => {
		expect(formatArea(43_560, 'sqft')).toBe('43,560 sq ft');
	});
});

describe('pointInPolygon', () => {
	// A simple axis-aligned square: outer ring corners at (±2, ±2).
	// GeoJSON [lon, lat]; pointInPolygon takes (lat, lon).
	const square = {
		type: 'Polygon',
		coordinates: [
			[
				[-2, -2],
				[2, -2],
				[2, 2],
				[-2, 2],
				[-2, -2],
			],
		],
	};

	test('returns true for a point inside the polygon', () => {
		expect(pointInPolygon(0, 0, square)).toBe(true);
	});

	test('returns false for a point outside the polygon', () => {
		expect(pointInPolygon(5, 5, square)).toBe(false);
	});

	test('returns false for null geometry', () => {
		expect(pointInPolygon(0, 0, null)).toBe(false);
	});

	test('returns false for a point inside a polygon hole', () => {
		const withHole = {
			type: 'Polygon',
			coordinates: [
				[
					[-2, -2],
					[2, -2],
					[2, 2],
					[-2, 2],
					[-2, -2],
				], // outer ring
				[
					[-0.5, -0.5],
					[0.5, -0.5],
					[0.5, 0.5],
					[-0.5, 0.5],
					[-0.5, -0.5],
				], // hole
			],
		};

		// Inside the hole → outside the field
		expect(pointInPolygon(0, 0, withHole)).toBe(false);
		// Inside the outer ring but outside the hole → inside the field
		expect(pointInPolygon(1.5, 0, withHole)).toBe(true);
	});

	test('handles MultiPolygon — point is in one of the parts', () => {
		const multi = {
			type: 'MultiPolygon',
			coordinates: [
				[
					[
						[-2, -2],
						[-1, -2],
						[-1, -1],
						[-2, -1],
						[-2, -2],
					],
				],
				[
					[
						[1, 1],
						[2, 1],
						[2, 2],
						[1, 2],
						[1, 1],
					],
				],
			],
		};

		expect(pointInPolygon(-1.5, -1.5, multi)).toBe(true);
		expect(pointInPolygon(1.5, 1.5, multi)).toBe(true);
		expect(pointInPolygon(0, 0, multi)).toBe(false);
	});
});

describe('centroidFromGeometry', () => {
	test('returns null for null geometry', () => {
		expect(centroidFromGeometry(null)).toBeNull();
	});

	test('returns an object with lat and lon', () => {
		const c = centroidFromGeometry(UNIT_SQUARE);

		expect(c).not.toBeNull();
		expect(typeof c.lat).toBe('number');
		expect(typeof c.lon).toBe('number');
	});

	test('centroid of a symmetric square falls inside its bounds', () => {
		const c = centroidFromGeometry(UNIT_SQUARE);

		expect(c.lat).toBeGreaterThan(0);
		expect(c.lat).toBeLessThan(1);
		expect(c.lon).toBeGreaterThan(0);
		expect(c.lon).toBeLessThan(1);
	});

	test('centroid of an L-shaped polygon is inside the polygon, not in the notch', () => {
		// An L-shape: a 3×3 square with the top-right 1×1 corner removed.
		// GeoJSON [lon, lat]. The arithmetic vertex mean falls in the missing corner.
		// The area-weighted centroid must fall inside the actual polygon.
		const lShape = {
			type: 'Polygon',
			coordinates: [
				[
					[0, 0],
					[3, 0],
					[3, 2],
					[1, 2],
					[1, 3],
					[0, 3],
					[0, 0],
				],
			],
		};

		const c = centroidFromGeometry(lShape);

		expect(c).not.toBeNull();
		expect(pointInPolygon(c.lat, c.lon, lShape)).toBe(true);
	});
});
