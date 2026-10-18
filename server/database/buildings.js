import { collectionDBs } from './database';
import { collectionStore } from './store';

const buildings = collectionStore(['name', 'type', 'emoji', 'geometry', 'status', 'showLabel', 'notes', 'properties'], collectionDBs.buildings);

export default buildings;
