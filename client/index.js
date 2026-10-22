import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { Page } from '@vanilla-bean/components';

import { AppShell, MainContent } from './Layout';
import Nav from './Nav';
import router from './router';
import { mountOfflineIndicator } from './OfflineIndicator';
import { initOfflineQueue } from './offlineQueue';
import { mountWeatherAlerts } from './WeatherAlerts';
import { mountLoginScreen } from './Login';
import { mountQuickLogButton } from './QuickLog';
import { getMe } from './api/auth';
import context from './context';
import { wrapFetch, initLiveSync } from './liveSync';

import '@vanilla-bean/components/app/reloadOnBuild';

const onQueueState = mountOfflineIndicator();

// wrapFetch MUST run before initOfflineQueue so that the x-client-id header wrapper
// is in place when offlineQueue captures window.fetch. Without this ordering, queued
// replay requests miss the header and the server echoes them back to this tab, causing
// false conflict dialogs on every offline sync.
wrapFetch();

// Check session before mounting anything.
// /auth/me returns { enabled: false } when auth is off (no login needed),
// or { enabled: true, id, name, roles } when logged in,
// or 401 (null) when auth is on but no session exists.
const me = await getMe();

initOfflineQueue(onQueueState, me);

if (me === null) {
	// Auth enabled, no session — show login screen only.
	// Reload on success so the app initialises fresh with the session cookie.
	mountLoginScreen(() => window.location.reload());
} else {
	// Either auth is disabled or we have a valid session — mount the app.
	context.currentUser = me.enabled ? { id: me.id, name: me.name, roles: me.roles } : null;

	if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
		navigator.serviceWorker.register('/sw.js').catch(() => {});
	}

	const shell = new AppShell({ appendTo: document.body });

	new Nav({ appendTo: shell });

	const main = new MainContent({ appendTo: shell });

	new Page({ appendTo: main, append: router });

	mountWeatherAlerts();
	mountQuickLogButton();
	initLiveSync();
}
