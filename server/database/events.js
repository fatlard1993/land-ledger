import { createCRUD } from './crud';
import archiveDb from './archive';

const events = createCRUD(
	'events',
	['fieldId', 'date', 'season', 'category', 'name', 'emoji', 'details', 'notes', 'properties'],
	{},
	archiveDb,
);

export default events;
