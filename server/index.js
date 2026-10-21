#!/usr/bin/env bun

import os from 'os';
import path from 'path';
import { existsSync } from 'fs';

import { devConsole } from '@vanilla-bean/components/app';
import Argi from 'argi';

import database from './database';
import archiveDb from './database/archive';
import { runMigrations } from './database/migrate.js';
import settingsDb from './database/settings';
import weatherDb from './database/weather';
import benchmarksDb from './database/benchmarks';
import server from './server';
import { setAgAnalyticsKey, setParcelServiceUrl } from './router';
import { setNassApiKey } from './router/benchmarks';
import { migrateApiTokens, pruneSessions, setTlsActive } from './auth';
import { setPrecisionLayersPath } from './router/precisionLayers';

import './exit';

const { options } = new Argi({
	options: {
		database: {
			type: 'string',
			alias: 'd',
			defaultValue: path.join(os.homedir(), '.landLedger.json'),
			description: 'Database json file to use',
		},
		port: {
			type: 'number',
			alias: 'p',
			defaultValue: 7450,
		},
		agAnalyticsKey: {
			type: 'string',
			defaultValue: process.env.AG_ANALYTICS_KEY || '',
			description: 'Ag-Analytics API key for CLU boundary data (optional, falls back to OSM)',
		},
		nassApiKey: {
			type: 'string',
			defaultValue: process.env.NASS_API_KEY || '',
			description: 'USDA NASS Quick Stats API key for county yield benchmarks (free at quickstats.nass.usda.gov/api)',
		},
		parcelServiceUrl: {
			type: 'string',
			defaultValue: process.env.PARCEL_SERVICE_URL || '',
			description:
				'County ArcGIS REST parcel service URL (e.g. https://county-gis.gov/arcgis/rest/services/Parcels/MapServer/0)',
		},
	},
});

if (process.env.NODE_ENV === 'development') console.log('Options', options);

await database.init({ path: options.database });

const archivePath = options.database.replace('.json', '-archive.json');

await archiveDb.init({ path: archivePath });
await runMigrations();

const settingsPath = options.database.replace('.json', '-settings.json');

await settingsDb.init({ path: settingsPath });
await migrateApiTokens();
await pruneSessions();

// Ensure the default admin account exists.
// Auth is disabled by default — enable it via the admin panel when ready.
if (!settingsDb.get('accounts')?.length) {
	const defaultHash = await Bun.password.hash('admin');

	await settingsDb.set('accounts', [
		{
			id: 'admin',
			name: 'Admin',
			passkey: defaultHash,
			roles: { admin: true, financials: true, farmhand: true },
		},
	]);

	console.log('[auth] Default admin account created — passkey is "admin". Change it before enabling auth.');
	await settingsDb.set('adminPasskeyIsDefault', true);
}

const weatherPath = options.database.replace('.json', '-weather.json');
const benchmarksPath = options.database.replace('.json', '-benchmarks.json');

setPrecisionLayersPath(options.database);

await weatherDb.init({ path: weatherPath });
await benchmarksDb.init({ path: benchmarksPath });

// CLI flags take priority over saved settings
const agKey = options.agAnalyticsKey || settingsDb.get('agAnalyticsKey');
const parcelUrl = options.parcelServiceUrl || settingsDb.get('parcelServiceUrl');

if (agKey) {
	setAgAnalyticsKey(agKey);
	console.log('CLU boundary data: Ag-Analytics');
} else console.log('CLU boundary data: OpenStreetMap');

const nassKey = options.nassApiKey || settingsDb.get('nassApiKey');
if (nassKey) {
	setNassApiKey(nassKey);
	console.log('USDA NASS: configured');
} else console.log('USDA NASS: not configured  (add nassApiKey to settings for county yield benchmarks)');

if (parcelUrl) {
	setParcelServiceUrl(parcelUrl);
	console.log(`Parcel boundaries: ${parcelUrl}`);
} else console.log('Parcel boundaries: OpenStreetMap (configure via app settings or --parcelServiceUrl)');

// Auto-detect TLS cert — generated once by running: bun run cert
const certPath = options.database.replace('.json', '-cert.pem');
const keyPath = options.database.replace('.json', '-key.pem');

const tls = existsSync(certPath) && existsSync(keyPath) ? { cert: Bun.file(certPath), key: Bun.file(keyPath) } : null;

if (!tls) {
	console.log('HTTPS: disabled  (run "bun run cert" to enable PWA support on your network)');
}

setTlsActive(!!tls);
server.init({ port: options.port, tls });

devConsole();
