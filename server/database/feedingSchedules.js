import { collectionDBs } from './database';
import { createCRUD } from './crud';

const feedingSchedules = createCRUD(
	'feedingSchedules',
	['fieldId', 'feedType', 'amountPerHead', 'amountUnit', 'frequency', 'supplyId', 'notes'],
	{},
	collectionDBs.feedingSchedules,
);

export default feedingSchedules;
