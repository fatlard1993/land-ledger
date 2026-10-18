import { archiveStore } from './store';

// Stores yield maps and as-applied maps from combine/planter monitors.
// Point data lives in separate files (~/.landLedger-layer-{id}.json) so
// 5,000 GPS points don't bloat the archive on unrelated reads and writes.
// This record holds only metadata + precomputed stats.
const precisionLayers = archiveStore('precisionLayers', [
	'fieldId',
	'type', // 'yield' | 'as-applied' | 'soil-ec' | 'other'
	'season',
	'crop',
	'label', // display name e.g. "Corn yield 2025"
	'valueField', // original column name from source data
	'valueUnit', // bu/ac, seeds/ac, lbs/ac, etc.
	'stats', // {count, mean, stdDev, cv, min, max, p25, p50, p75}
	'notes',
]);

export default precisionLayers;
