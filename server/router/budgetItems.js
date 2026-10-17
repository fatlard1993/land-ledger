import { requestMatch } from '@vanilla-bean/components/app';
import { budgetItems } from '../database';
import { entityResponse } from '../utils/entityResponse.js';

const budgetItemsRouter = async request => {
	let match;

	match = requestMatch('GET', '/budget-items', request);
	if (match) return Response.json(budgetItems.read());

	match = requestMatch('POST', '/budget-items', request);
	if (match) return Response.json(await budgetItems.create(await request.json()), { status: 201 });

	match = requestMatch('GET', '/budget-items/:id', request);
	if (match) {
		const item = budgetItems.read(match);

		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/budget-items/:id', request);
	if (match) {
		const item = await budgetItems.update({ ...match, update: await request.json() });

		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/budget-items/:id', request);
	if (match) return new Response(null, { status: (await budgetItems.delete(match)) ? 204 : 404 });
};

export default budgetItemsRouter;
