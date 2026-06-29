import requestMatch from '../utils/requestMatch';
import { MAX_FILE_BYTES } from '../utils/limitBody.js';

const importRouter = async request => {
	const match = requestMatch('POST', '/import/geojson', request);

	if (!match) return;

	try {
		const formData = await request.formData();
		const file = formData.get('file');

		if (!file) return new Response('No file provided', { status: 400 });
		if (file.size > MAX_FILE_BYTES) return new Response('File too large (max 10 MB)', { status: 413 });

		const text = await file.text();
		const geojson = JSON.parse(text);

		if (!geojson.type) return new Response('Invalid GeoJSON', { status: 400 });

		const singleFeature =
			geojson.type === 'Feature' ? [geojson] : [{ type: 'Feature', geometry: geojson, properties: {} }];
		const features = geojson.type === 'FeatureCollection' ? geojson.features : singleFeature;

		const polygonFeatures = features.filter(f => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon');

		if (!polygonFeatures.length) return new Response('No polygon features found', { status: 422 });

		return Response.json({ features: polygonFeatures });
	} catch (error) {
		console.error('Import failed:', error);

		return new Response('Invalid file', { status: 400 });
	}
};

export default importRouter;
