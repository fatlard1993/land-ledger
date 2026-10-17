import { requestMatch } from '@vanilla-bean/components/app';
import { breedingRecords, animals } from '../database';
import { entityResponse } from '../utils/entityResponse.js';

// Gestation in days by species — used to compute expectedDueDate
const GESTATION = {
	cattle: 283,
	sheep: 147,
	goat: 150,
	pig: 114,
	horse: 340,
	alpaca: 345,
	llama: 345,
	donkey: 365,
};

function withExpectedDueDate(body) {
	const data = { ...body };

	if (data.breedingDate && !data.expectedDueDate) {
		// Look up the dam's species to pick the right gestation period
		const dam = data.damId ? animals.read({ id: data.damId }) : null;
		const days = (dam?.species ? GESTATION[dam.species.toLowerCase()] : null) ?? 150; // default ~goat

		const d = new Date(`${data.breedingDate}T12:00:00`);
		d.setDate(d.getDate() + days);
		data.expectedDueDate = d.toISOString().slice(0, 10);
	}

	return data;
}

const breedingRecordsRouter = async request => {
	let match;

	match = requestMatch('GET', '/breeding-records', request);
	if (match) return Response.json(breedingRecords.read());

	match = requestMatch('POST', '/breeding-records', request);
	if (match)
		return Response.json(await breedingRecords.create(withExpectedDueDate(await request.json())), { status: 201 });

	match = requestMatch('GET', '/breeding-records/:id', request);
	if (match) {
		const item = breedingRecords.read(match);
		return entityResponse(item);
	}

	match = requestMatch('PATCH', '/breeding-records/:id', request);
	if (match) {
		const item = await breedingRecords.update({ ...match, update: withExpectedDueDate(await request.json()) });
		return entityResponse(item);
	}

	match = requestMatch('DELETE', '/breeding-records/:id', request);
	if (match) return new Response(null, { status: (await breedingRecords.delete(match)) ? 204 : 404 });
};

export default breedingRecordsRouter;
