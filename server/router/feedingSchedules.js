import { feedingSchedules } from '../database';
import { entityResponse } from '../utils/entityResponse.js';
import requestMatch from '../utils/requestMatch';

const feedingSchedulesRouter = async request => {
	let match;

	match = requestMatch('GET', '/feeding-schedules', request);
	if (match) return Response.json(feedingSchedules.read());

	match = requestMatch('POST', '/feeding-schedules', request);
	if (match) return Response.json(await feedingSchedules.create(await request.json()), { status: 201 });

	match = requestMatch('GET', '/feeding-schedules/:id', request);
	if (match) {
		const item = feedingSchedules.read(match);

		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/feeding-schedules/:id', request);
	if (match) {
		const item = await feedingSchedules.update({ ...match, update: await request.json() });

		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/feeding-schedules/:id', request);
	if (match) return new Response(null, { status: (await feedingSchedules.delete(match)) ? 204 : 404 });
};

export default feedingSchedulesRouter;
