import { archiveStore } from './store';

const incidents = archiveStore('incidents', [
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
]);

export default incidents;
