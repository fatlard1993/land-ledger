import { collectionDBs } from './database';
import { createCRUD } from './crud';

const supplies = createCRUD(
	'supplies',
	[
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
	],
	{},
	collectionDBs.supplies,
);

export default supplies;
