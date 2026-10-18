import { collectionDBs } from './database';
import { collectionStore } from './store';

const paths = collectionStore(['name', 'type', 'emoji', 'widthFt', 'color', 'status', 'showLabel', 'geometry', 'notes', 'properties'], collectionDBs.paths);

export default paths;
