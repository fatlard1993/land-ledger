import { requestMatch } from '@vanilla-bean/components/app';
import { revenue } from '../database';
import { entityResponse } from '../utils/entityResponse.js';

const revenueRouter = async request => {
	let match;

	match = requestMatch('GET', '/revenue', request);
	if (match) return Response.json(revenue.read());

	match = requestMatch('POST', '/revenue', request);
	if (match) return Response.json(await revenue.create(await request.json()), { status: 201 });

	match = requestMatch('GET', '/revenue/:id', request);
	if (match) {
		const item = revenue.read(match);

		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/revenue/:id', request);
	if (match) {
		const item = await revenue.update({ ...match, update: await request.json() });

		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/revenue/:id', request);
	if (match) return new Response(null, { status: (await revenue.delete(match)) ? 204 : 404 });
};

export default revenueRouter;
