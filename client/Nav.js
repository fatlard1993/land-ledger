import { Elem, Icon } from '@vanilla-bean/components';

import { BottomNav, NavItem } from './Layout';
import context from './context';
import { logout } from './api/auth';

const BASE_ITEMS = [
	{ path: '/', icon: 'map-location-dot', label: 'Map' },
	{ path: '/Fields', icon: 'wheat-awn', label: 'Fields' },
	{ path: '/Todo', icon: 'list-check', label: 'To Do' },
	{ path: '/Timeline', icon: 'calendar-days', label: 'Timeline' },
];

const LEASES_ITEM = { path: '/Leases', icon: 'file-signature', label: 'Leases' };
const SUPPLIES_ITEM = { path: '/Supplies', icon: 'boxes-stacked', label: 'Supplies' };
const FINANCIALS_ITEM = { path: '/Financials', icon: 'sack-dollar', label: 'Financials' };
const INCIDENTS_ITEM = { path: '/Incidents', icon: 'triangle-exclamation', label: 'Incidents' };
const MAINTENANCE_ITEM = { path: '/Maintenance', icon: 'wrench', label: 'Maintenance' };
const FEEDING_ITEM = { path: '/Feeding', icon: 'cow', label: 'Feeding' };
const APPLICATIONS_ITEM = { path: '/Applications', icon: 'flask', label: 'Applications' };
const ANIMALS_ITEM = { path: '/Animals', icon: 'paw', label: 'Animals' };

export default class Nav extends BottomNav {
	build() {
		this._itemMap = new Map();

		this._buildItems();

		const onHashChange = () => this._updateActive();

		window.addEventListener('hashchange', onHashChange);
		this._updateActive();

		const rebuild = () => {
			this._buildItems();
			this._updateActive();
		};

		const subs = [
			'hasLeases',
			'hasSupplies',
			'hasIncidents',
			'hasMaintenanceHistory',
			'hasFeedingHistory',
			'hasApplicationLogs',
			'hasAnimals',
			'currentUser',
		].map(key => context.subscribe({ key, callback: rebuild }));

		this.addCleanup('nav', () => {
			window.removeEventListener('hashchange', onHashChange);
			subs.forEach(s => s.unsubscribe());
		});
	}

	_buildItems() {
		this.empty();
		this._itemMap.clear();

		const user = context.currentUser;

		// Role helpers — when auth is disabled, currentUser is null and all gating is off
		const canFinancials = !user || user.roles.admin || user.roles.financials;
		// With auth off every route is open, so the Admin panel is too: it is where sign-in gets turned on
		const isAdmin = !user || user.roles.admin;

		const showLeases = context.hasLeases;
		const showSupplies = context.hasSupplies;
		const showIncidents = context.hasIncidents;
		const showMaintenance = context.hasMaintenanceHistory;
		const showFeeding = context.hasFeedingHistory;
		const showApplications = context.hasApplicationLogs;
		const showAnimals = context.hasAnimals;

		const middle = [
			...(showLeases ? [LEASES_ITEM] : []),
			...(showSupplies ? [SUPPLIES_ITEM] : []),
			...(canFinancials ? [FINANCIALS_ITEM] : []),
			...(showIncidents ? [INCIDENTS_ITEM] : []),
			...(showMaintenance ? [MAINTENANCE_ITEM] : []),
			...(showFeeding ? [FEEDING_ITEM] : []),
			...(showApplications ? [APPLICATIONS_ITEM] : []),
			...(showAnimals ? [ANIMALS_ITEM] : []),
		];

		const items = [BASE_ITEMS[0], BASE_ITEMS[1], ...middle, BASE_ITEMS[2], BASE_ITEMS[3]];

		for (const { path, icon, label } of items) {
			const item = new NavItem({
				appendTo: this,
				onPointerPress: () => {
					window.location.hash = path === '/' ? '' : path;
				},
			});

			new Icon({ appendTo: item, addClass: 'nav-icon', icon });
			new Elem({ tag: 'span', appendTo: item, addClass: 'nav-label', textContent: label });

			this._itemMap.set(path, item);
		}

		// Admin controls — accounts, and turning sign-in on or off
		if (isAdmin) {
			const adminItem = new NavItem({
				appendTo: this,
				title: 'Manage accounts & auth',
				onPointerPress: async () => {
					const { default: AccountsDialog } = await import('./Admin/AccountsDialog.js');

					new AccountsDialog();
				},
			});

			new Icon({ appendTo: adminItem, addClass: 'nav-icon', icon: 'user-gear' });
			new Elem({ tag: 'span', appendTo: adminItem, addClass: 'nav-label', textContent: 'Admin' });
		}

		// Logout — visible whenever auth is enabled and user is logged in
		if (user) {
			const logoutItem = new NavItem({
				appendTo: this,
				title: `Signed in as ${user.name} — tap to sign out`,
				onPointerPress: async () => {
					await logout();
					window.location.reload();
				},
			});

			new Icon({ appendTo: logoutItem, addClass: 'nav-icon', icon: 'right-from-bracket' });
			new Elem({ tag: 'span', appendTo: logoutItem, addClass: 'nav-label', textContent: 'Sign out' });
		}
	}

	_updateActive() {
		const currentPath = window.location.hash.replace(/^#\/?/, '/').replace(/\?.*$/, '') || '/';

		for (const [path, item] of this._itemMap) {
			item.toggleClass('active', currentPath === path || (path !== '/' && currentPath.startsWith(path)));
		}
	}
}
