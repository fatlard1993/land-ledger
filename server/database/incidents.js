import { createCRUD } from './crud';
import archiveDb from './archive';

const incidents = createCRUD(
	'incidents',
	[
		'date',
		'type',
		'severity',
		'entityType',
		'entityId',
		'entityName',
		'description',
		'estimatedLoss',
		'insuranceClaim',
		'livestockLosses',
		'resolved',
		'resolutionNotes',
		'notes',
		'properties',
	],
	{},
	archiveDb,
);

export default incidents;
