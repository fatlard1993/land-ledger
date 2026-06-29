import { applicationLogs } from '../database';
import { entityResponse } from '../utils/entityResponse.js';
import requestMatch from '../utils/requestMatch';

const applicationLogsRouter = async request => {
	let match;

	match = requestMatch('GET', '/application-logs', request);
	if (match) return Response.json(applicationLogs.read());

	match = requestMatch('POST', '/application-logs', request);
	if (match) return Response.json(await applicationLogs.create(await request.json()), { status: 201 });

	match = requestMatch('GET', '/application-logs/:id', request);
	if (match) {
		const item = applicationLogs.read(match);
		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/application-logs/:id', request);
	if (match) {
		const item = await applicationLogs.update({ ...match, update: await request.json() });
		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/application-logs/:id', request);
	if (match) return new Response(null, { status: (await applicationLogs.delete(match)) ? 204 : 404 });
};

export default applicationLogsRouter;
