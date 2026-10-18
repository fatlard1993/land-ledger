import { collectionDBs } from './database';
import { collectionStore } from './store';

const equipment = collectionStore([
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
	], collectionDBs.equipment);

export default equipment;
