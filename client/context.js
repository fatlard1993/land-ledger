import { Oxject } from '@vanilla-bean/components';

const context = new Oxject({
	hasLeases: false,
	hasSupplies: false,
	hasIncidents: false,
	hasMaintenanceHistory: false,
	hasFeedingHistory: false,
	hasApplicationLogs: false,
	hasAnimals: false,
	currentUser: null, // { id, name, roles } or null when auth disabled
});

export default context;
