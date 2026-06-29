import { buildings } from '../database';
import { entityResponse } from '../utils/entityResponse.js';
import requestMatch from '../utils/requestMatch';

const buildingsRouter = async request => {
	let match;

	match = requestMatch('GET', '/buildings', request);
	if (match) return Response.json(buildings.read());

	match = requestMatch('POST', '/buildings', request);
	if (match) return Response.json(await buildings.create(await request.json()), { status: 201 });

	match = requestMatch('GET', '/buildings/:id', request);
	if (match) {
		const item = buildings.read(match);

		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/buildings/:id', request);
	if (match) {
		const item = await buildings.update({ ...match, update: await request.json() });

		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/buildings/:id', request);
	if (match) return new Response(null, { status: (await buildings.delete(match)) ? 204 : 404 });
};

export default buildingsRouter;
