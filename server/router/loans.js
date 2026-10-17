import { requestMatch } from '@vanilla-bean/components/app';
import { loans } from '../database';

import { entityResponse } from '../utils/entityResponse.js';

const loansRouter = async request => {
	let match;

	match = requestMatch('GET', '/loans', request);
	if (match) return Response.json(loans.read());

	match = requestMatch('POST', '/loans', request);
	if (match) return Response.json(await loans.create(await request.json()), { status: 201 });

	match = requestMatch('GET', '/loans/:id', request);
	if (match) {
		const item = loans.read(match);

		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/loans/:id', request);
	if (match) {
		const item = await loans.update({ ...match, update: await request.json() });

		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/loans/:id', request);
	if (match) return new Response(null, { status: (await loans.delete(match)) ? 204 : 404 });
};

export default loansRouter;
