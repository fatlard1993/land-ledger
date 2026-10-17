import { requestMatch } from '@vanilla-bean/components/app';
import { paths } from '../database';
import { entityResponse } from '../utils/entityResponse.js';

const pathsRouter = async request => {
	let match;

	match = requestMatch('GET', '/paths', request);
	if (match) return Response.json(paths.read());

	match = requestMatch('POST', '/paths', request);
	if (match) return Response.json(await paths.create(await request.json()), { status: 201 });

	match = requestMatch('GET', '/paths/:id', request);
	if (match) {
		const item = paths.read(match);

		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/paths/:id', request);
	if (match) {
		const item = await paths.update({ ...match, update: await request.json() });

		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/paths/:id', request);
	if (match) return new Response(null, { status: (await paths.delete(match)) ? 204 : 404 });
};

export default pathsRouter;
