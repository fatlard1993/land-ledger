import { collectionDBs } from './database';
import { createCRUD } from './crud';

const parcels = createCRUD(
	'parcels',
	['name', 'parcelId', 'owner', 'geometry', 'acreage', 'acreageUnit', 'status', 'showLabel', 'notes', 'properties'],
	{},
	collectionDBs.parcels,
);

export default parcels;
