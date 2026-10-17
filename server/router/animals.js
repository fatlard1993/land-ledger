import { requestMatch } from '@vanilla-bean/components/app';
import { animals } from '../database';
import { entityResponse } from '../utils/entityResponse.js';

const animalsRouter = async request => {
	let match;

	match = requestMatch('GET', '/animals', request);
	if (match) return Response.json(animals.read());

	match = requestMatch('POST', '/animals', request);
	if (match) return Response.json(await animals.create(await request.json()), { status: 201 });

	match = requestMatch('GET', '/animals/:id', request);
	if (match) {
		const item = animals.read(match);
		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/animals/:id', request);
	if (match) {
		const item = await animals.update({ ...match, update: await request.json() });
		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/animals/:id', request);
	if (match) return new Response(null, { status: (await animals.delete(match)) ? 204 : 404 });
};

export default animalsRouter;
