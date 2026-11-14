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
import { ROUTES, movedRoute } from './routes';

// A bookmark or link from before the paths were lowercase opens its view, not the map: on load, and ahead of the
// router's own listeners (popstate comes before hashchange)
const followMoved = () => {
	const moved = movedRoute(window.location.hash);

	if (moved) window.history.replaceState(null, '', moved);
};

followMoved();
window.addEventListener('popstate', followMoved);
window.addEventListener('hashchange', followMoved);

const router = new Router({
	defaultPath: '/',
	views: {
		[ROUTES.map]: MapView,
		[ROUTES.fields]: Fields,
		[ROUTES.leases]: Leases,
		[ROUTES.supplies]: Supplies,
		[ROUTES.timeline]: Timeline,
		[ROUTES.financials]: Financials,
		[ROUTES.todo]: Todo,
		[ROUTES.incidents]: Incidents,
		[ROUTES.maintenance]: Maintenance,
		[ROUTES.feeding]: Feeding,
		[ROUTES.applications]: ApplicationLogs,
		[ROUTES.animals]: Animals,
	},
});

export default router;
