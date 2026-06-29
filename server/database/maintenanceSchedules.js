import { collectionDBs } from './database';
import { createCRUD } from './crud';

const maintenanceSchedules = createCRUD(
	'maintenanceSchedules',
	['equipmentId', 'name', 'procedure', 'intervalUsage', 'intervalDays', 'lastDoneDate', 'lastDoneUsage', 'notes'],
	{},
	collectionDBs.maintenanceSchedules,
);

export default maintenanceSchedules;
