import { Router } from '@vanilla-bean/components';

import MapView from './Map';
import Fields from './Fields';
import Leases from './Leases';
import Timeline from './Timeline';
import Supplies from './Supplies';
import Financials from './Financials';
import Incidents from './Incidents';
import Maintenance from './Maintenance';
import Feeding from './Feeding';
import ApplicationLogs from './ApplicationLog';
import Animals from './Animals';
import Todo from './Todo';

const router = new Router({
	defaultPath: '/',
	views: {
		'/': MapView,
		'/Fields': Fields,
		'/Leases': Leases,
		'/Supplies': Supplies,
		'/Timeline': Timeline,
		'/Financials': Financials,
		'/Todo': Todo,
		'/Incidents': Incidents,
		'/Maintenance': Maintenance,
		'/Feeding': Feeding,
		'/Applications': ApplicationLogs,
		'/Animals': Animals,
	},
});

export default router;
