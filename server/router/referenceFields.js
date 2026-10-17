import { requestMatch } from '@vanilla-bean/components/app';

const OVERPASS_MIRRORS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter',
	'https://overpass.openstreetmap.ru/api/interpreter',
];

const osmWayToFeature = way => ({
	type: 'Feature',
	geometry: {
		type: 'Polygon',
		coordinates: [way.geometry.map(n => [n.lon, n.lat])],
	},
	properties: {
		source: 'osm',
		osm_id: way.id,
		name: way.tags?.name || '',
	},
});

const agAnalyticsToFeature = feature => ({
	type: 'Feature',
	geometry: feature.geometry,
	properties: {
		source: 'clu',
		name: feature.properties?.name || feature.properties?.CLU_IDENTIFIER || 'Field',
		...feature.properties,
	},
});

/**
 * Fetch with a manual timeout using Promise.race — AbortSignal.timeout behaviour varies in Bun
 * @param url
 * @param opts
 * @param ms
 */
const fetchWithTimeout = (url, opts, ms) => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ms);

	return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
};

const referenceFieldsRouter = async (request, agAnalyticsKey) => {
	const match = requestMatch('GET', '/reference-fields', request);

	if (!match) return;

	const { south, west, north, east } = match;

	if (!south || !west || !north || !east) return new Response('Missing bbox params', { status: 400 });

	const latSpan = Math.abs(parseFloat(north) - parseFloat(south));
	const lonSpan = Math.abs(parseFloat(east) - parseFloat(west));

	if (latSpan > 0.3 || lonSpan > 0.5) return Response.json({ features: [], tooZoomed: true });

	// Hard 20-second overall deadline so the connection always gets a response
	const deadline = new Promise(resolve =>
		setTimeout(() => resolve(Response.json({ features: [], error: true, message: 'timeout' })), 20_000),
	);

	return Promise.race([deadline, _loadFields(south, west, north, east, agAnalyticsKey)]);
};

const _loadFields = async (south, west, north, east, agAnalyticsKey) => {
	// Try Ag-Analytics first if key is configured
	if (agAnalyticsKey) {
		try {
			const envelope = JSON.stringify({
				xmin: parseFloat(west),
				ymin: parseFloat(south),
				xmax: parseFloat(east),
				ymax: parseFloat(north),
				spatialReference: { wkid: 4326 },
			});
			const url = new URL('https://ag-analytics.azure-api.net/CommonLandUnitBoundary-v2');

			url.searchParams.set('Geometry', envelope);
			url.searchParams.set('Geometry_type', 'envelope');

			const res = await fetchWithTimeout(
				url.toString(),
				{ headers: { 'Ocp-Apim-Subscription-Key': agAnalyticsKey } },
				8_000,
			);

			if (res.ok) {
				const data = await res.json();

				return Response.json({ features: (data?.results?.features || []).map(agAnalyticsToFeature), source: 'clu' });
			}
		} catch (err) {
			console.warn('Ag-Analytics fetch failed:', err?.message);
		}
	}

	// Overpass OSM fallback — try each mirror with a short timeout
	const bbox = `${south},${west},${north},${east}`;
	const query = `[out:json][timeout:6];(way[landuse=farmland](${bbox});way[landuse=farm](${bbox}););out geom qt 300;`;
	const encoded = encodeURIComponent(query);

	for (const mirror of OVERPASS_MIRRORS) {
		try {
			const res = await fetchWithTimeout(
				`${mirror}?data=${encoded}`,
				{ headers: { 'User-Agent': 'land-ledger/1.0', Accept: 'application/json' } },
				4_000,
			);

			if (!res.ok) {
				console.warn(`Overpass ${mirror} returned ${res.status}`);
				continue;
			}

			const data = await res.json();
			const features = (data.elements || [])
				.filter(el => el.type === 'way' && el.geometry?.length > 2)
				.map(osmWayToFeature);

			return Response.json({ features, source: 'osm' });
		} catch (err) {
			console.warn(`Overpass ${mirror} failed:`, err?.message);
		}
	}

	console.warn('All reference field sources failed');

	return Response.json({ features: [], error: true, message: 'All sources failed' });
};

export default referenceFieldsRouter;
