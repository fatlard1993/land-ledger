import { requestMatch } from '@vanilla-bean/components/app';
import { incidents } from '../database';
import { entityResponse } from '../utils/entityResponse.js';

const incidentsRouter = async request => {
	let match;

	match = requestMatch('GET', '/incidents', request);
	if (match) return Response.json(incidents.read());

	match = requestMatch('POST', '/incidents', request);
	if (match) return Response.json(await incidents.create(await request.json()), { status: 201 });

	match = requestMatch('GET', '/incidents/:id', request);
	if (match) {
		const item = incidents.read(match);

		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/incidents/:id', request);
	if (match) {
		const item = await incidents.update({ ...match, update: await request.json() });

		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/incidents/:id', request);
	if (match) return new Response(null, { status: (await incidents.delete(match)) ? 204 : 404 });
};

export default incidentsRouter;
