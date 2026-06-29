import { collectionDBs } from './database';
import { createCRUD } from './crud';

const paths = createCRUD(
	'paths',
	['name', 'type', 'emoji', 'widthFt', 'color', 'status', 'showLabel', 'geometry', 'notes', 'properties'],
	{},
	collectionDBs.paths,
);

export default paths;
