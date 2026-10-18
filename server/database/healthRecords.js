import { archiveStore } from './store';

const healthRecords = archiveStore('healthRecords', [
	'animalId',
	'date',
	'type', // vaccination | treatment | observation | injury
	'drug', // drug or vaccine name
	'dose', // e.g. "2mL"
	'route', // IM | SQ | oral | topical | IV
	'withdrawalDays', // days from label
	'withdrawalDate', // date + withdrawalDays (computed on create/update)
	'treatedBy',
	'notes',
	'properties',
]);

export default healthRecords;
