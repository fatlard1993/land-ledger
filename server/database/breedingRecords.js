import { archiveStore } from './store';

const breedingRecords = archiveStore('breedingRecords', [
		'damId', // animal ID of the dam
		'sire', // animal ID (internal) or external sire name
		'breedingDate',
		'expectedDueDate', // computed from breedingDate + species gestation
		'actualBirthDate',
		'litterSize',
		'offspringSurvived',
		'status', // pending | confirmed | delivered | failed
		'notes',
		'properties',
	]);

export default breedingRecords;
