import { requestMatch } from '@vanilla-bean/components/app';
import { fields } from '../database';

import { entityResponse } from '../utils/entityResponse.js';

const fieldsRouter = async request => {
	let match;

	match = requestMatch('GET', '/fields', request);
	if (match) return Response.json(fields.read());

	match = requestMatch('POST', '/fields', request);
	if (match) return Response.json(await fields.create(await request.json()), { status: 201 });

	match = requestMatch('GET', '/fields/:id', request);
	if (match) {
		const item = fields.read(match);

		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/fields/:id', request);
	if (match) {
		const item = await fields.update({ ...match, update: await request.json() });

		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/fields/:id', request);
	if (match) return new Response(null, { status: (await fields.delete(match)) ? 204 : 404 });
};

export default fieldsRouter;
