import { collectionDBs } from './database';
import { collectionStore } from './store';

const feedingSchedules = collectionStore(['fieldId', 'feedType', 'amountPerHead', 'amountUnit', 'frequency', 'supplyId', 'notes'], collectionDBs.feedingSchedules);

export default feedingSchedules;
