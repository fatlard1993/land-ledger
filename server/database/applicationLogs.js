import { archiveStore } from './store';

const applicationLogs = archiveStore('applicationLogs', [
	'fieldId',
	'date',
	'category', // herbicide | insecticide | fungicide | fertilizer | fuel | adjuvant | other
	'product', // commercial product name
	'epaRegNumber', // EPA registration number (NNNNN-NNNNN or NNNNN-NNNNN-NNNNN)
	'activeIngredients',
	'rate', // numeric rate value
	'rateUnit', // oz/ac, lbs/ac, gal/ac, etc.
	'acresTreated',
	'totalApplied', // total product used (rate × acres, or entered directly)
	'totalUnit', // unit for total quantity
	'method', // application method
	'targetPest', // target pest, weed, or disease
	'rei', // re-entry interval (hours)
	'phi', // pre-harvest interval (days)
	'operatorName',
	'operatorLicense',
	'windSpeed', // mph at application
	'temperature', // °F at application
	'notes',
	'properties',
]);

export default applicationLogs;
