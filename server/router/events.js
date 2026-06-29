import { events } from '../database';

import { entityResponse } from '../utils/entityResponse.js';
import requestMatch from '../utils/requestMatch';

const eventsRouter = async request => {
	let match;

	match = requestMatch('GET', '/events', request);
	if (match) return Response.json(events.read());

	match = requestMatch('POST', '/events', request);
	if (match) return Response.json(await events.create(await request.json()), { status: 201 });

	match = requestMatch('GET', '/events/:id', request);
	if (match) {
		const item = events.read(match);

		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/events/:id', request);
	if (match) {
		const item = await events.update({ ...match, update: await request.json() });

		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/events/:id', request);
	if (match) return new Response(null, { status: (await events.delete(match)) ? 204 : 404 });
};

export default eventsRouter;
