import { requestMatch } from '@vanilla-bean/components/app';
import { healthRecords } from '../database';
import { entityResponse } from '../utils/entityResponse.js';

// Compute withdrawalDate from date + withdrawalDays before writing
function withWithdrawalDate(body) {
	const data = { ...body };

	if (data.date && data.withdrawalDays) {
		const d = new Date(`${data.date}T12:00:00`);
		d.setDate(d.getDate() + Number(data.withdrawalDays));
		data.withdrawalDate = d.toISOString().slice(0, 10);
	} else {
		data.withdrawalDate = '';
	}

	return data;
}

const healthRecordsRouter = async request => {
	let match;

	match = requestMatch('GET', '/health-records', request);
	if (match) return Response.json(healthRecords.read());

	match = requestMatch('POST', '/health-records', request);
	if (match)
		return Response.json(await healthRecords.create(withWithdrawalDate(await request.json())), { status: 201 });

	match = requestMatch('GET', '/health-records/:id', request);
	if (match) {
		const item = healthRecords.read(match);
		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/health-records/:id', request);
	if (match) {
		const item = await healthRecords.update({ ...match, update: withWithdrawalDate(await request.json()) });
		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/health-records/:id', request);
	if (match) return new Response(null, { status: (await healthRecords.delete(match)) ? 204 : 404 });
};

export default healthRecordsRouter;
