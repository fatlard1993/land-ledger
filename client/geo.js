import turfArea from '@turf/area';
import turfCentroid from '@turf/centroid';

export const AREA_UNITS = [
	{ value: 'sqft', label: 'sq ft', decimals: 0 },
	{ value: 'ac', label: 'ac', decimals: 1 },
	{ value: 'ha', label: 'ha', decimals: 2 },
];

// Returns area in square metres (base unit for all conversions).
// Delegates to Turf's spherical excess algorithm, which handles polygon holes
// and MultiPolygon correctly.
export const geodesicAreaSqm = geometry => {
	if (!geometry) return 0;
	return turfArea(geometry);
};

export const convertArea = (sqm, unit = 'ac') => {
	if (!sqm) return 0;

	const unitMeta = AREA_UNITS.find(u => u.value === unit) || AREA_UNITS[1];
	let value;

	switch (unit) {
		case 'sqft':
			value = sqm * 10.7639;
			break;
		case 'ha':
			value = sqm / 10_000;
			break;
		default:
			value = sqm * 0.000247105;
			break;
	}

	return Number(value.toFixed(unitMeta.decimals));
};

export const formatArea = (value, unit = 'ac') => {
	if (value == null || value === '') return '';

	const num = Number(value);
	const meta = AREA_UNITS.find(u => u.value === unit) || AREA_UNITS[1];

	if (unit === 'sqft') return `${num.toLocaleString('en-US', { maximumFractionDigits: 0 })} sq ft`;

	return `${num.toFixed(meta.decimals)} ${meta.label}`;
};

export const geodesicAcreage = geometry => convertArea(geodesicAreaSqm(geometry), 'ac');

// Convert a stored area value (in its given unit) to square metres
export const toSqm = (value, unit = 'ac') => {
	if (!value) return 0;
	const v = Number(value);

	switch (unit) {
		case 'sqft':
			return v / 10.7639;
		case 'ha':
			return v * 10_000;
		default:
			return v / 0.000247105; // acres
	}
};

// Ray-casting point-in-polygon using even-odd winding rule.
// Correctly handles Polygon holes and MultiPolygon. GeoJSON coords are [lon, lat].
export const pointInPolygon = (lat, lon, geometry) => {
	if (!geometry || lat == null || lon == null) return false;

	const castRing = ring => {
		let inside = false;

		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			const xi = ring[i][0],
				yi = ring[i][1];
			const xj = ring[j][0],
				yj = ring[j][1];

			if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
				inside = !inside;
			}
		}

		return inside;
	};

	// For Polygon: apply even-odd across all rings (outer + holes).
	// For MultiPolygon: apply across all outer rings of each polygon.
	const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates || [];

	return polygons.some(rings => {
		// Even-odd: XOR across all rings; holes correctly invert the result
		let crossings = 0;

		for (const ring of rings) {
			if (castRing(ring)) crossings++;
		}

		return crossings % 2 === 1;
	});
};

export const centroidFromGeometry = geometry => {
	if (!geometry) return null;

	try {
		const [lon, lat] = turfCentroid({ type: 'Feature', geometry }).geometry.coordinates;
		return { lat, lon };
	} catch {
		return null;
	}
};
