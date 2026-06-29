import { leases } from '../database';

import { entityResponse } from '../utils/entityResponse.js';
import requestMatch from '../utils/requestMatch';

const leasesRouter = async request => {
	let match;

	match = requestMatch('GET', '/leases', request);
	if (match) return Response.json(leases.read());

	match = requestMatch('POST', '/leases', request);
	if (match) return Response.json(await leases.create(await request.json()), { status: 201 });

	match = requestMatch('GET', '/leases/:id', request);
	if (match) {
		const item = leases.read(match);

		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/leases/:id', request);
	if (match) {
		const item = await leases.update({ ...match, update: await request.json() });

		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/leases/:id', request);
	if (match) return new Response(null, { status: (await leases.delete(match)) ? 204 : 404 });
};

export default leasesRouter;
