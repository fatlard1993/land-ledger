import { collectionDBs } from './database';
import { collectionStore } from './store';

const budgetItems = collectionStore([
		'name',
		'type',
		'category',
		'amount',
		'frequency',
		'entityType',
		'entityId',
		'entityName',
		'startDate',
		'endDate',
		'notes',
		'properties',
	], collectionDBs.budgetItems);

export default budgetItems;
