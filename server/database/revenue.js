import { archiveStore } from './store';

const revenue = archiveStore('revenue', [
	'entityType',
	'entityId',
	'entityName',
	'date',
	'amount',
	'type',
	'description',
	'notes',
	'properties',
]);

export default revenue;
