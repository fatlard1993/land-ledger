import { maintenanceSchedules } from '../database';
import { entityResponse } from '../utils/entityResponse.js';
import requestMatch from '../utils/requestMatch';

const maintenanceSchedulesRouter = async request => {
	let match;

	match = requestMatch('GET', '/maintenance-schedules', request);
	if (match) return Response.json(maintenanceSchedules.read());

	match = requestMatch('POST', '/maintenance-schedules', request);
	if (match) return Response.json(await maintenanceSchedules.create(await request.json()), { status: 201 });

	match = requestMatch('GET', '/maintenance-schedules/:id', request);
	if (match) {
		const item = maintenanceSchedules.read(match);

		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/maintenance-schedules/:id', request);
	if (match) {
		const item = await maintenanceSchedules.update({ ...match, update: await request.json() });

		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/maintenance-schedules/:id', request);
	if (match) return new Response(null, { status: (await maintenanceSchedules.delete(match)) ? 204 : 404 });
};

export default maintenanceSchedulesRouter;
