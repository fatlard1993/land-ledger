import { archiveStore } from './store';

const feedingLogs = archiveStore('feedingLogs', [
	'scheduleId',
	'fieldId',
	'feedType',
	'amountPerHead',
	'amountUnit',
	'headCount',
	'type',
	'date',
	'notes',
]);

export default feedingLogs;
