import { Component, Elem } from '@vanilla-bean/components';

import { BottomNav, NavItem } from './Layout';
import context from './context';
import { logout } from './api/auth';

const BASE_ITEMS = [
	{ path: '/', icon: '🗺️', label: 'Map' },
	{ path: '/Fields', icon: '📋', label: 'Fields' },
	{ path: '/Todo', icon: '✅', label: 'To Do' },
	{ path: '/Timeline', icon: '📅', label: 'Timeline' },
];

const LEASES_ITEM = { path: '/Leases', icon: '📝', label: 'Leases' };
const SUPPLIES_ITEM = { path: '/Supplies', icon: '📦', label: 'Supplies' };
const FINANCIALS_ITEM = { path: '/Financials', icon: '💵', label: 'Financials' };
const INCIDENTS_ITEM = { path: '/Incidents', icon: '⚠️', label: 'Incidents' };
const MAINTENANCE_ITEM = { path: '/Maintenance', icon: '🔧', label: 'Maintenance' };
const FEEDING_ITEM = { path: '/Feeding', icon: '🐄', label: 'Feeding' };
const APPLICATIONS_ITEM = { path: '/Applications', icon: '🧪', label: 'Applications' };
const ANIMALS_ITEM = { path: '/Animals', icon: '🐾', label: 'Animals' };

export default class Nav extends Component {
	constructor(options = {}) {
		super(options);
	}

	build() {
		this.nav = new BottomNav({ appendTo: this });
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
		this.nav.empty();
		this._itemMap.clear();

		const user = context.currentUser;

		// Role helpers — when auth is disabled, currentUser is null and all gating is off
		const canFinancials = !user || user.roles.admin || user.roles.financials;
		const isAdmin = user?.roles.admin;

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
				appendTo: this.nav,
				onPointerPress: () => {
					window.location.hash = path === '/' ? '' : path;
				},
			});

			new Elem({ tag: 'span', appendTo: item, addClass: 'nav-icon', textContent: icon });
			new Elem({ tag: 'span', appendTo: item, addClass: 'nav-label', textContent: label });

			this._itemMap.set(path, item);
		}

		// Admin controls — only visible when auth is enabled and user is admin
		if (isAdmin) {
			const adminItem = new NavItem({
				appendTo: this.nav,
				title: 'Manage accounts & auth',
				onPointerPress: async () => {
					const { default: AccountsDialog } = await import('./Admin/AccountsDialog.js');

					new AccountsDialog();
				},
			});

			new Elem({ tag: 'span', appendTo: adminItem, addClass: 'nav-icon', textContent: '👤' });
			new Elem({ tag: 'span', appendTo: adminItem, addClass: 'nav-label', textContent: 'Admin' });
		}

		// Logout — visible whenever auth is enabled and user is logged in
		if (user) {
			const logoutItem = new NavItem({
				appendTo: this.nav,
				title: `Signed in as ${user.name} — tap to sign out`,
				onPointerPress: async () => {
					await logout();
					window.location.reload();
				},
			});

			new Elem({ tag: 'span', appendTo: logoutItem, addClass: 'nav-icon', textContent: '🔓' });
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
