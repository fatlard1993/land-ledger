import { maintenance } from '../database';
import { entityResponse } from '../utils/entityResponse.js';
import requestMatch from '../utils/requestMatch';

const maintenanceRouter = async request => {
	let match;

	match = requestMatch('GET', '/maintenance', request);
	if (match) return Response.json(maintenance.read());

	match = requestMatch('POST', '/maintenance', request);
	if (match) return Response.json(await maintenance.create(await request.json()), { status: 201 });

	match = requestMatch('GET', '/maintenance/:id', request);
	if (match) {
		const item = maintenance.read(match);

		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/maintenance/:id', request);
	if (match) {
		const item = await maintenance.update({ ...match, update: await request.json() });

		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/maintenance/:id', request);
	if (match) return new Response(null, { status: (await maintenance.delete(match)) ? 204 : 404 });
};

export default maintenanceRouter;
