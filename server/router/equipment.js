import { equipment } from '../database';
import { entityResponse } from '../utils/entityResponse.js';
import requestMatch from '../utils/requestMatch';

const equipmentRouter = async request => {
	let match;

	match = requestMatch('GET', '/equipment', request);
	if (match) return Response.json(equipment.read());

	match = requestMatch('POST', '/equipment', request);
	if (match) return Response.json(await equipment.create(await request.json()), { status: 201 });

	match = requestMatch('GET', '/equipment/:id', request);
	if (match) {
		const item = equipment.read(match);

		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/equipment/:id', request);
	if (match) {
		const item = await equipment.update({ ...match, update: await request.json() });

		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/equipment/:id', request);
	if (match) return new Response(null, { status: (await equipment.delete(match)) ? 204 : 404 });
};

export default equipmentRouter;
