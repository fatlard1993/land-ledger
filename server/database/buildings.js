import { collectionDBs } from './database';
import { createCRUD } from './crud';

const buildings = createCRUD(
	'buildings',
	['name', 'type', 'emoji', 'geometry', 'status', 'showLabel', 'notes', 'properties'],
	{},
	collectionDBs.buildings,
);

export default buildings;
