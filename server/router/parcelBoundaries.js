import { requestMatch } from '@vanilla-bean/components/app';

const OVERPASS_MIRRORS = [
	'https://overpass.kumi.systems/api/interpreter',
	'https://overpass.openstreetmap.ru/api/interpreter',
	'https://overpass-api.de/api/interpreter',
];

const osmWayToFeature = (way, source) => {
	if (!way.geometry?.length) return null;

	const coords = way.geometry.map(n => [n.lon, n.lat]);

	// Close the ring if needed
	if (
		coords.length > 0 &&
		(coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])
	) {
		coords.push(coords[0]);
	}

	if (coords.length < 4) return null;

	return {
		type: 'Feature',
		geometry: { type: 'Polygon', coordinates: [coords] },
		properties: {
			source,
			osm_id: way.id,
			name: way.tags?.name || way.tags?.['addr:street'] || '',
			parcelId: way.tags?.['ref'] || way.tags?.['addr:housenumber'] || '',
			landuse: way.tags?.landuse || way.tags?.boundary || '',
		},
	};
};

const arcgisFeatureToGeoJSON = (feature, _fields) => {
	if (!feature.geometry?.rings?.length) return null;

	const rings = feature.geometry.rings.map(ring => ring.map(p => [p[0], p[1]]));
	const props = {};
	const attrs = feature.attributes || {};

	// Map common parcel attribute names
	const fieldMap = {
		name: ['OWNER', 'OWNER_NAME', 'OWNERNME', 'NAME'],
		parcelId: ['APN', 'PARCEL_NO', 'PARCELID', 'PARCEL_ID', 'PIN', 'TAXPIN', 'ASSESSOR_NO'],
		acreage: ['ACRES', 'GIS_ACRES', 'CALC_ACRES', 'TOTALACRE'],
		address: ['SITEADDR', 'SITE_ADDR', 'ADDRESS', 'PROP_ADDR'],
	};

	for (const [key, candidates] of Object.entries(fieldMap)) {
		for (const candidate of candidates) {
			if (attrs[candidate] != null) {
				props[key] = String(attrs[candidate]);
				break;
			}
		}
	}

	return {
		type: 'Feature',
		geometry: { type: 'Polygon', coordinates: rings },
		properties: { source: 'arcgis', ...props },
	};
};

const queryOverpass = async bbox => {
	const { south, west, north, east } = bbox;
	const bboxStr = `${south},${west},${north},${east}`;

	const query = `[out:json][timeout:20];(
		way[boundary=land_area](${bboxStr});
		way[landuse=residential](${bboxStr});
		way[landuse=farmland](${bboxStr});
		way[landuse=farm](${bboxStr});
		way[landuse=meadow](${bboxStr});
	);out geom qt 400;`;

	let res = null;
	let lastError = null;

	for (const mirror of OVERPASS_MIRRORS) {
		try {
			res = await fetch(`${mirror}?data=${encodeURIComponent(query)}`, {
				headers: { 'User-Agent': 'land-ledger/1.0', Accept: 'application/json' },
				signal: AbortSignal.timeout(8_000),
			});

			if (res.ok) break;

			lastError = new Error(`${mirror} ${res.status}`);
			res = null;
		} catch (err) {
			lastError = err;
			res = null;
		}
	}

	if (!res) throw lastError || new Error('Overpass unavailable');

	const data = await res.json();
	const features = (data.elements || [])
		.filter(el => el.type === 'way')
		.map(way => osmWayToFeature(way, 'osm'))
		.filter(Boolean);

	return { features, source: 'osm' };
};

const queryArcGIS = async (serviceUrl, bbox) => {
	const { south, west, north, east } = bbox;

	const geometry = JSON.stringify({
		xmin: parseFloat(west),
		ymin: parseFloat(south),
		xmax: parseFloat(east),
		ymax: parseFloat(north),
		spatialReference: { wkid: 4326 },
	});

	const url = new URL(`${serviceUrl}/query`);

	url.searchParams.set('geometry', geometry);
	url.searchParams.set('geometryType', 'esriGeometryEnvelope');
	url.searchParams.set('inSR', '4326');
	url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
	url.searchParams.set('outFields', '*');
	url.searchParams.set('outSR', '4326');
	url.searchParams.set('f', 'geojson');
	url.searchParams.set('returnGeometry', 'true');
	url.searchParams.set('resultRecordCount', '500');

	const res = await fetch(url, {
		headers: { 'User-Agent': 'land-ledger/1.0' },
		signal: AbortSignal.timeout(10_000),
	});

	if (!res.ok) throw new Error(`ArcGIS ${res.status}`);

	const data = await res.json();

	// ArcGIS returns either GeoJSON FeatureCollection or Esri JSON
	if (data.features) {
		const features = data.features
			.filter(f => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon' || f.geometry?.rings)
			.map(f => {
				if (f.geometry?.rings) return arcgisFeatureToGeoJSON(f, data.fields);
				return { ...f, properties: { ...f.properties, source: 'arcgis' } };
			})
			.filter(Boolean);

		return { features, source: 'arcgis' };
	}

	return { features: [], source: 'arcgis' };
};

let _parcelServiceUrl = null;

export const setParcelServiceUrl = url => {
	_parcelServiceUrl = url;
};

const parcelBoundariesRouter = async request => {
	const match = requestMatch('GET', '/parcel-boundaries', request);

	if (!match) return;

	const { south, west, north, east } = match;

	if (!south || !west || !north || !east) return new Response('Missing bbox', { status: 400 });

	const latSpan = Math.abs(parseFloat(north) - parseFloat(south));
	const lonSpan = Math.abs(parseFloat(east) - parseFloat(west));

	if (latSpan > 0.3 || lonSpan > 0.5) {
		return Response.json({ features: [], tooZoomed: true });
	}

	const bbox = { south, west, north, east };

	// Try configured ArcGIS service first
	if (_parcelServiceUrl) {
		try {
			const result = await queryArcGIS(_parcelServiceUrl, bbox);

			if (result.features.length > 0) return Response.json(result);
		} catch (error) {
			console.warn('ArcGIS parcel query failed, falling back to OSM:', error.message);
		}
	}

	// Fall back to Overpass
	try {
		const result = await queryOverpass(bbox);

		return Response.json(result);
	} catch (error) {
		console.error('Parcel boundary fetch failed:', error.message);

		return new Response('Failed to fetch parcel boundaries', { status: 502 });
	}
};

export default parcelBoundariesRouter;
