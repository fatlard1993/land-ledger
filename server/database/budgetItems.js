import { collectionDBs } from './database';
import { createCRUD } from './crud';

const budgetItems = createCRUD(
	'budgetItems',
	[
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
	],
	{},
	collectionDBs.budgetItems,
);

export default budgetItems;
