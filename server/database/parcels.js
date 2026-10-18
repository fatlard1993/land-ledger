import { collectionDBs } from './database';
import { collectionStore } from './store';

const parcels = collectionStore(['name', 'parcelId', 'owner', 'geometry', 'acreage', 'acreageUnit', 'status', 'showLabel', 'notes', 'properties'], collectionDBs.parcels);

export default parcels;
