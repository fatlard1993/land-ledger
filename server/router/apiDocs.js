import { requestMatch } from '@vanilla-bean/components/app';

import { version } from '../../package.json';

const COLLECTIONS = {
	fields: 'GET /fields, POST /fields, GET /fields/:id, PATCH /fields/:id, DELETE /fields/:id',
	leases: 'GET /leases, POST /leases, GET /leases/:id, PATCH /leases/:id, DELETE /leases/:id',
	loans: 'GET /loans, POST /loans, GET /loans/:id, PATCH /loans/:id, DELETE /loans/:id',
	buildings: 'GET /buildings, POST /buildings, GET /buildings/:id, PATCH /buildings/:id, DELETE /buildings/:id',
	equipment: 'GET /equipment, POST /equipment, GET /equipment/:id, PATCH /equipment/:id, DELETE /equipment/:id',
	paths: 'GET /paths, POST /paths, GET /paths/:id, PATCH /paths/:id, DELETE /paths/:id',
	supplies: 'GET /supplies, POST /supplies, GET /supplies/:id, PATCH /supplies/:id, DELETE /supplies/:id',
	parcels: 'GET /parcels, POST /parcels, GET /parcels/:id, PATCH /parcels/:id, DELETE /parcels/:id',
	events: 'GET /events, POST /events, GET /events/:id, PATCH /events/:id, DELETE /events/:id',
	maintenance:
		'GET /maintenance, POST /maintenance, GET /maintenance/:id, PATCH /maintenance/:id, DELETE /maintenance/:id',
	maintenanceSchedules:
		'GET /maintenance-schedules, POST /maintenance-schedules, PATCH /maintenance-schedules/:id, DELETE /maintenance-schedules/:id',
	incidents: 'GET /incidents, POST /incidents, GET /incidents/:id, PATCH /incidents/:id, DELETE /incidents/:id',
	feedingSchedules:
		'GET /feeding-schedules, POST /feeding-schedules, PATCH /feeding-schedules/:id, DELETE /feeding-schedules/:id',
	feedingLogs: 'GET /feeding-logs, POST /feeding-logs, DELETE /feeding-logs/:id',
	revenue: 'GET /revenue, POST /revenue, GET /revenue/:id, PATCH /revenue/:id, DELETE /revenue/:id',
	budgetItems:
		'GET /budget-items, POST /budget-items, GET /budget-items/:id, PATCH /budget-items/:id, DELETE /budget-items/:id',
	applicationLogs:
		'GET /application-logs, POST /application-logs, GET /application-logs/:id, PATCH /application-logs/:id, DELETE /application-logs/:id',
	animals: 'GET /animals, POST /animals, GET /animals/:id, PATCH /animals/:id, DELETE /animals/:id',
	healthRecords:
		'GET /health-records, POST /health-records, GET /health-records/:id, PATCH /health-records/:id, DELETE /health-records/:id',
	breedingRecords:
		'GET /breeding-records, POST /breeding-records, GET /breeding-records/:id, PATCH /breeding-records/:id, DELETE /breeding-records/:id',
};

const API_DOC = {
	name: 'Land Ledger API',
	description: 'Self-hosted farm management. Every route returns and accepts JSON.',
	version,

	authentication: {
		method: 'Bearer token or session cookie',
		header: 'Authorization: Bearer <token>',
		tokenManagement: {
			create: 'POST /auth/tokens  (requires admin session)',
			list: 'GET /auth/tokens   (requires admin session)',
			revoke: 'DELETE /auth/tokens/:id (requires admin session)',
		},
		note: 'When auth is disabled (default), all routes are open. Enable auth via POST /auth/settings.',
	},

	collections: COLLECTIONS,

	import: {
		geojson: 'POST /import/geojson  — multipart form, file field, returns polygon features',
		parse: 'POST /import/tabular/parse  — multipart form, file field (CSV or JSON), returns {columns, rows}',
		apply: 'POST /import/tabular/apply  — JSON {collection, rows, mapping}, creates records',
		templates: {
			list: 'GET /import/tabular/templates',
			save: 'POST /import/tabular/templates  — {name, collection, mapping}',
			remove: 'DELETE /import/tabular/templates/:name',
		},
	},

	export: {
		geojson: 'GET /export/geojson?type=fields|buildings|parcels|paths|equipment|all',
		csv: 'GET /export/csv?collection=events|supplies|equipment|maintenance|revenue|...',
		csvTemplate: 'GET /export/csv/template?name=<template-name>',
		backup: 'GET /export/json  — full database backup {exportedAt, main, archive}',
	},

	utilities: {
		weather: 'GET /weather?lat=&lng=&start=YYYY-MM-DD&end=YYYY-MM-DD  — forecast + archive, °F',
		geocode: 'GET /geocode?q=  — Nominatim forward geocode',
		reverse: 'GET /geocode/reverse?lat=&lon=',
		parcels: 'GET /parcel-boundaries?south=&west=&north=&east=  — ArcGIS or OSM fallback',
		clu: 'GET /reference-fields?south=&west=&north=&east=  — USDA CLU or OSM farmland',
		benchmarks:
			'GET /benchmarks/county-yield?state=&county=&crop=&year=  — USDA NASS county yield average (requires nassApiKey in /settings)',
	},
};

const apiDocsRouter = request => {
	if (!requestMatch('GET', '/api', request)) return;
	return Response.json(API_DOC, {
		headers: { 'Access-Control-Allow-Origin': '*' }, // API docs are always public
	});
};

export default apiDocsRouter;
