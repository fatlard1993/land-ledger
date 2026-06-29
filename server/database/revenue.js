import { createCRUD } from './crud';
import archiveDb from './archive';

const revenue = createCRUD(
	'revenue',
	['entityType', 'entityId', 'entityName', 'date', 'amount', 'type', 'description', 'notes', 'properties'],
	{},
	archiveDb,
);

export default revenue;
