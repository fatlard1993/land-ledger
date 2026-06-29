import { createCRUD } from './crud';
import archiveDb from './archive';

const feedingLogs = createCRUD(
	'feedingLogs',
	['scheduleId', 'fieldId', 'feedType', 'amountPerHead', 'amountUnit', 'headCount', 'type', 'date', 'notes'],
	{},
	archiveDb,
);

export default feedingLogs;
