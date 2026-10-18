import { ConflictError, requestMatch, serveStatic } from '@vanilla-bean/components/app';

import { requireAuth, requireRole } from '../auth';
import { enforceJsonBodyLimit, MAX_JSON_BYTES } from '../utils/limitBody.js';
import collectionsRoutes from './collections';
import importRoutes from './import';
import tabularImportRoutes from './tabularImport';
import referenceFieldsRoutes from './referenceFields';
import geocodeRoutes from './geocode';
import parcelBoundariesRoutes, { setParcelServiceUrl } from './parcelBoundaries';
import settingsRoutes from './settings';
import weatherRoutes from './weather';
import exportRoutes from './export';
import benchmarksRoutes from './benchmarks';
import precisionLayersRoutes from './precisionLayers';
import precisionAnalysisRoutes from './precisionAnalysis';
import changesRoutes, { broadcastChange, broadcastPresence } from './changes';
import presenceRoutes from './presence';
import authRoutes from './auth';
import sharedRoutes from './shared';
import apiDocsRoutes from './apiDocs';

let _agAnalyticsKey = null;

export const setAgAnalyticsKey = key => {
	_agAnalyticsKey = key;
};

export { setParcelServiceUrl };

// Tries each handler in order; returns the first non-null response, or null if none match.
const dispatch = async (request, handlers) => {
	for (const handler of handlers) {
		const response = await handler(request);
		if (response) return response;
	}
	return null;
};

const FINANCIAL_PREFIXES = ['/revenue', '/budget-items', '/loans'];

const router = async request => {
	try {
		// ── App shell ────────────────────────────────────────────────────────────
		if (requestMatch('GET', '/', request)) return new Response(Bun.file('client/build/index.html'));

		// ── Public routes (no auth required) ────────────────────────────────────
		const pub = await dispatch(request, [apiDocsRoutes, authRoutes, sharedRoutes, serveStatic]);
		if (pub) return pub;

		// ── Body size guard ──────────────────────────────────────────────────────
		// File-upload routes use multipart/form-data and enforce their own per-file
		// limit; skip the JSON cap for those so we don't reject valid uploads.
		if (
			['POST', 'PATCH'].includes(request.method) &&
			!request.headers.get('content-type')?.includes('multipart/form-data')
		) {
			const sizeGuard = await enforceJsonBodyLimit(request, MAX_JSON_BYTES);
			if (sizeGuard) return sizeGuard;
		}

		// ── Auth gate ────────────────────────────────────────────────────────────
		const authGuard = requireAuth(request);
		if (authGuard) return authGuard;

		// Financial routes require the financials (or admin) role in addition to auth
		const { pathname } = new URL(request.url);
		if (FINANCIAL_PREFIXES.some(p => pathname.startsWith(p))) {
			const roleGuard = requireRole(request, ['financials', 'admin']);
			if (roleGuard) return roleGuard;
		}

		// ── Protected routes ─────────────────────────────────────────────────────
		const response = await dispatch(request, [
			collectionsRoutes,
			importRoutes,
			tabularImportRoutes,
			r => referenceFieldsRoutes(r, _agAnalyticsKey),
			geocodeRoutes,
			parcelBoundariesRoutes,
			settingsRoutes,
			weatherRoutes,
			exportRoutes,
			benchmarksRoutes,
			precisionLayersRoutes,
			precisionAnalysisRoutes,
			changesRoutes,
			r => presenceRoutes(r, broadcastPresence),
		]);

		if (response) {
			// Broadcast mutations to all other connected clients.
			// POST creates return 201; read-only POSTs (analyze, preview, geocode) return 200 — skip those.
			if (
				['POST', 'PATCH', 'DELETE'].includes(request.method) &&
				response.status < 300 &&
				(request.method !== 'POST' || response.status === 201)
			) {
				const parts = new URL(request.url).pathname.split('/').filter(Boolean);
				broadcastChange(parts[0], parts[1] ?? null, request.headers.get('x-client-id'));
			}
			return response;
		}

		return request.method === 'GET'
			? new Response(Bun.file('client/build/index.html'))
			: new Response('Not Found', { status: 404 });
	} catch (error) {
		if (error instanceof SyntaxError) return new Response('Invalid JSON', { status: 400 });
		// The client's conflict dialog reads { _conflict, current }
		if (error instanceof ConflictError) return Response.json({ _conflict: true, current: error.current }, { status: 409 });

		console.error(`[router] ${request.method} ${request.url} failed:`, error);

		return new Response('Server Error', { status: 500 });
	}
};

export default router;
