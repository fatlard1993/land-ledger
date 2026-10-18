import { collectionDBs } from './database';
import { collectionStore } from './store';

const maintenanceSchedules = collectionStore(['equipmentId', 'name', 'procedure', 'intervalUsage', 'intervalDays', 'lastDoneDate', 'lastDoneUsage', 'notes'], collectionDBs.maintenanceSchedules);

export default maintenanceSchedules;
