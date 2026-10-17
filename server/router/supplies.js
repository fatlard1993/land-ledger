import { requestMatch } from '@vanilla-bean/components/app';
import { supplies } from '../database';
import { entityResponse } from '../utils/entityResponse.js';

const suppliesRouter = async request => {
	let match;

	match = requestMatch('GET', '/supplies', request);
	if (match) return Response.json(supplies.read());

	match = requestMatch('POST', '/supplies', request);
	if (match) return Response.json(await supplies.create(await request.json()), { status: 201 });

	match = requestMatch('GET', '/supplies/:id', request);
	if (match) {
		const item = supplies.read(match);

		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/supplies/:id', request);
	if (match) {
		const item = await supplies.update({ ...match, update: await request.json() });

		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/supplies/:id', request);
	if (match) return new Response(null, { status: (await supplies.delete(match)) ? 204 : 404 });
};

export default suppliesRouter;
