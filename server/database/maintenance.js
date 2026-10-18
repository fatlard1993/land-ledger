import { archiveStore } from './store';

const maintenance = archiveStore('maintenance', ['equipmentId', 'workType', 'type', 'date', 'usageAtService', 'cost', 'parts', 'procedure', 'notes', 'properties']);

export default maintenance;
