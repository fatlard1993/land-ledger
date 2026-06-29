import { collectionDBs } from './database';
import { createCRUD } from './crud';

// Historical records (events, seasons, history, leases, incidents, feeding logs) are
// intentionally NOT cascade-deleted when a field is removed. Those records have
// independent value for financial tracking, yield history, and audit purposes — they
// should persist and remain queryable even after the field is no longer on the map.
const fields = createCRUD(
	'fields',
	['name', 'geometry', 'acreage', 'acreageUnit', 'tenure', 'state', 'county', 'status', 'showLabel', 'properties'],
	{},
	collectionDBs.fields,
);

export default fields;
