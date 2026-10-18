import { collectionDBs } from './database';
import { collectionStore } from './store';

const supplies = collectionStore([
		'name',
		'category',
		'emoji',
		'unit',
		'costPerUnit',
		'priceMode',
		'markupPercent',
		'pricePerUnit',
		'currentStock',
		'buildingId',
		'notes',
		'properties',
	], collectionDBs.supplies);

export default supplies;
