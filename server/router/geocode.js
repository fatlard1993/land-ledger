import { requestMatch } from '@vanilla-bean/components/app';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

const geocodeRouter = async request => {
	const reverseMatch = requestMatch('GET', '/geocode/reverse', request);

	if (reverseMatch) {
		const { lat, lon } = reverseMatch;

		if (!lat || !lon) return new Response('Missing lat/lon', { status: 400 });

		try {
			const url = new URL(NOMINATIM_REVERSE);

			url.searchParams.set('lat', lat);
			url.searchParams.set('lon', lon);
			url.searchParams.set('format', 'json');
			url.searchParams.set('zoom', '10');
			url.searchParams.set('addressdetails', '1');

			const res = await fetch(url, {
				headers: { 'User-Agent': 'land-ledger/1.0 farm-management-app', 'Accept-Language': 'en' },
				signal: AbortSignal.timeout(8_000),
			});

			if (!res.ok) throw new Error(`Nominatim reverse ${res.status}`);

			const data = await res.json();
			const address = data.address || {};

			return Response.json({
				county: address.county || address.district || address.municipality || '',
				state: address.state_code?.toUpperCase() || address.state || '',
			});
		} catch (error) {
			console.error('Reverse geocode failed:', error.message);

			return new Response('Reverse geocode failed', { status: 502 });
		}
	}

	const match = requestMatch('GET', '/geocode', request);

	if (!match) return;

	const { q } = match;

	if (!q?.trim()) return new Response('Missing q', { status: 400 });

	try {
		const url = new URL(NOMINATIM);

		url.searchParams.set('q', q);
		url.searchParams.set('format', 'json');
		url.searchParams.set('limit', '6');
		url.searchParams.set('addressdetails', '1');

		const res = await fetch(url, {
			headers: {
				'User-Agent': 'land-ledger/1.0 farm-management-app',
				'Accept-Language': 'en',
			},
			signal: AbortSignal.timeout(8_000),
		});

		if (!res.ok) throw new Error(`Nominatim ${res.status}`);

		const data = await res.json();

		return Response.json(
			data.map(r => ({
				label: r.display_name,
				lat: parseFloat(r.lat),
				lon: parseFloat(r.lon),
				bbox: r.boundingbox?.map(parseFloat),
			})),
		);
	} catch (error) {
		console.error('Geocode failed:', error.message);

		return new Response('Geocode failed', { status: 502 });
	}
};

export default geocodeRouter;
