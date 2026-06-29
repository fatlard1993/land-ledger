import { createCRUD } from './crud';
import archiveDb from './archive';

const healthRecords = createCRUD(
	'healthRecords',
	[
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
	],
	{},
	archiveDb,
);

export default healthRecords;
