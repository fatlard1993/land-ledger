import { createCRUD } from './crud';
import archiveDb from './archive';

const maintenance = createCRUD(
	'maintenance',
	['equipmentId', 'workType', 'type', 'date', 'usageAtService', 'cost', 'parts', 'procedure', 'notes', 'properties'],
	{},
	archiveDb,
);

export default maintenance;
