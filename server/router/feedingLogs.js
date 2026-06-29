import { feedingLogs } from '../database';
import { entityResponse } from '../utils/entityResponse.js';
import requestMatch from '../utils/requestMatch';

const feedingLogsRouter = async request => {
	let match;

	match = requestMatch('GET', '/feeding-logs', request);
	if (match) return Response.json(feedingLogs.read());

	match = requestMatch('POST', '/feeding-logs', request);
	if (match) return Response.json(await feedingLogs.create(await request.json()), { status: 201 });

	match = requestMatch('GET', '/feeding-logs/:id', request);
	if (match) {
		const item = feedingLogs.read(match);

		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/feeding-logs/:id', request);
	if (match) {
		const item = await feedingLogs.update({ ...match, update: await request.json() });

		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/feeding-logs/:id', request);
	if (match) return new Response(null, { status: (await feedingLogs.delete(match)) ? 204 : 404 });
};

export default feedingLogsRouter;
