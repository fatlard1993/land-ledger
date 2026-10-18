import { archiveStore } from './store';

const events = archiveStore('events', [
	'fieldId',
	'date',
	'season',
	'category',
	'name',
	'emoji',
	'details',
	'notes',
	'properties',
]);

export default events;
