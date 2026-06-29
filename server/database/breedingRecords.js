import { createCRUD } from './crud';
import archiveDb from './archive';

const breedingRecords = createCRUD(
	'breedingRecords',
	[
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
	],
	{},
	archiveDb,
);

export default breedingRecords;
