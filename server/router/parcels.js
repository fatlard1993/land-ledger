import { requestMatch } from '@vanilla-bean/components/app';
import { parcels } from '../database';
import { entityResponse } from '../utils/entityResponse.js';

const parcelsRouter = async request => {
	let match;

	match = requestMatch('GET', '/parcels', request);
	if (match) return Response.json(parcels.read());

	match = requestMatch('POST', '/parcels', request);
	if (match) return Response.json(await parcels.create(await request.json()), { status: 201 });

	match = requestMatch('GET', '/parcels/:id', request);
	if (match) {
		const item = parcels.read(match);

		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/parcels/:id', request);
	if (match) {
		const item = await parcels.update({ ...match, update: await request.json() });

		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/parcels/:id', request);
	if (match) return new Response(null, { status: (await parcels.delete(match)) ? 204 : 404 });
};

export default parcelsRouter;
