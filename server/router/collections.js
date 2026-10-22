import { crudRoutes } from '@vanilla-bean/components/app';

import {
	animals,
	applicationLogs,
	breedingRecords,
	budgetItems,
	buildings,
	equipment,
	events,
	feedingLogs,
	feedingSchedules,
	fields,
	healthRecords,
	incidents,
	leases,
	loans,
	maintenance,
	maintenanceSchedules,
	parcels,
	paths,
	revenue,
	supplies,
} from '../database';
import { addDays } from '../utils/dates';

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

// A breeding date without a due date gets one, from the dam's species
export const withExpectedDueDate = body => {
	const data = { ...body };

	if (data.breedingDate && !data.expectedDueDate) {
		const dam = data.damId ? animals.read({ id: data.damId }) : null;
		const days = (dam?.species ? GESTATION[dam.species.toLowerCase()] : null) ?? 150; // default ~goat

		data.expectedDueDate = addDays(data.breedingDate, days);
	}

	return data;
};

// A treatment's withdrawal date follows from its date and withdrawal days, and is cleared without them
export const withWithdrawalDate = body => {
	const data = { ...body };

	data.withdrawalDate = data.date && data.withdrawalDays ? addDays(data.date, Number(data.withdrawalDays)) : '';

	return data;
};

// A store whose creates and updates fill in fields derived from the others first
const deriving = (store, derive) => ({
	read: options => store.read(options),
	delete: options => store.delete(options),
	create: body => store.create(derive(body)),
	update: ({ id, update }) => store.update({ id, update: derive(update) }),
});

const collections = {
	'/fields': fields,
	'/leases': leases,
	'/loans': loans,
	'/events': events,
	'/buildings': buildings,
	'/equipment': equipment,
	'/parcels': parcels,
	'/paths': paths,
	'/supplies': supplies,
	'/maintenance': maintenance,
	'/maintenance-schedules': maintenanceSchedules,
	'/incidents': incidents,
	'/feeding-schedules': feedingSchedules,
	'/feeding-logs': feedingLogs,
	'/application-logs': applicationLogs,
	'/animals': animals,
	'/health-records': deriving(healthRecords, withWithdrawalDate),
	'/breeding-records': deriving(breedingRecords, withExpectedDueDate),
	'/revenue': revenue,
	'/budget-items': budgetItems,
};

const routes = Object.entries(collections).map(([path, store]) => crudRoutes(path, store));

// Each collection's list, create, read, update and delete
const collectionsRouter = async request => {
	for (const route of routes) {
		const response = await route(request);

		if (response) return response;
	}
};

export default collectionsRouter;
