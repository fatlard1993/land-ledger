import { collectionDBs } from './database';
import { createCRUD } from './crud';

const equipment = createCRUD(
	'equipment',
	[
		'name',
		'type',
		'tenure',
		'emoji',
		'lat',
		'lng',
		'usage',
		'usageUnit',
		'size',
		'status',
		'appraisalValue',
		'showLabel',
		'notes',
		'properties',
	],
	{},
	collectionDBs.equipment,
);

export default equipment;
