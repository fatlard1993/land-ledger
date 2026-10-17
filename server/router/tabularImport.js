import { requestMatch } from '@vanilla-bean/components/app';

import parseCSV from '../utils/parseCSV';
import { MAX_FILE_BYTES, MAX_IMPORT_ROWS } from '../utils/limitBody.js';
import settingsDb from '../database/settings';
import events from '../database/events';
import supplies from '../database/supplies';
import revenue from '../database/revenue';
import maintenance from '../database/maintenance';

const COLLECTIONS = {
	events,
	supplies,
	revenue,
	maintenance,
};

// Known fields per collection — anything else goes into properties
const COLLECTION_FIELDS = {
	events: new Set(['fieldId', 'date', 'season', 'category', 'name', 'emoji', 'notes']),
	supplies: new Set(['name', 'category', 'emoji', 'unit', 'costPerUnit', 'currentStock', 'notes']),
	revenue: new Set(['date', 'amount', 'type', 'description', 'entityType', 'entityName', 'notes']),
	maintenance: new Set(['equipmentId', 'date', 'workType', 'type', 'cost', 'parts', 'procedure', 'notes']),
};

function toObjects(rows) {
	if (rows.length < 2) return { columns: rows[0] ?? [], rows: [] };

	const columns = rows[0];
	const data = rows
		.slice(1)
		.filter(r => r.some(v => v !== ''))
		.map(r => Object.fromEntries(columns.map((h, i) => [h, r[i] ?? ''])));

	return { columns, rows: data };
}

const tabularImportRouter = async request => {
	// ── Parse ─────────────────────────────────────────────────────────────────
	const parseMatch = requestMatch('POST', '/import/tabular/parse', request);

	if (parseMatch) {
		try {
			const formData = await request.formData();
			const file = formData.get('file');

			if (!file) return new Response('No file provided', { status: 400 });
			if (file.size > MAX_FILE_BYTES) return new Response('File too large (max 10 MB)', { status: 413 });

			const text = await file.text();
			const name = file.name?.toLowerCase() ?? '';

			if (name.endsWith('.json') || text.trimStart().startsWith('[') || text.trimStart().startsWith('{')) {
				const parsed = JSON.parse(text);
				const arr = Array.isArray(parsed) ? parsed : (parsed.data ?? parsed.records ?? []);

				if (!arr.length || typeof arr[0] !== 'object')
					return new Response('JSON must be an array of objects', { status: 422 });

				const columns = Object.keys(arr[0]);

				return Response.json({ columns, rows: arr });
			}

			const { columns, rows } = toObjects(parseCSV(text));

			if (!columns.length) return new Response('No columns detected', { status: 422 });

			return Response.json({ columns, rows });
		} catch (error) {
			console.error('[tabularImport] parse failed:', error);

			return new Response('Could not parse file', { status: 400 });
		}
	}

	// ── Apply ──────────────────────────────────────────────────────────────────
	const applyMatch = requestMatch('POST', '/import/tabular/apply', request);

	if (applyMatch) {
		let body;

		try {
			body = await request.json();
		} catch {
			return new Response('Invalid JSON', { status: 400 });
		}

		const { collection, rows, mapping, defaults = {} } = body;

		if (!COLLECTIONS[collection]) return new Response(`Unknown collection: ${collection}`, { status: 400 });
		if (!Array.isArray(rows)) return new Response('rows must be an array', { status: 400 });
		if (rows.length > MAX_IMPORT_ROWS) return new Response(`Too many rows (max ${MAX_IMPORT_ROWS})`, { status: 413 });
		if (!mapping || typeof mapping !== 'object') return new Response('mapping must be an object', { status: 400 });

		const crud = COLLECTIONS[collection];
		const knownFields = COLLECTION_FIELDS[collection];

		const invalidTargets = Object.values(mapping).filter(
			f => f !== '_skip' && f !== '_properties' && !knownFields.has(f),
		);

		if (invalidTargets.length) {
			return new Response(
				`Invalid mapping targets for "${collection}": ${invalidTargets.join(', ')}. Valid fields: ${[...knownFields].join(', ')}`,
				{ status: 400 },
			);
		}

		let created = 0;
		let errors = 0;

		for (const row of rows) {
			try {
				const record = { properties: {}, ...defaults };

				for (const [sourceCol, targetField] of Object.entries(mapping)) {
					const value = row[sourceCol];

					if (value === undefined || value === '' || targetField === '_skip') continue;

					if (targetField === '_properties') {
						record.properties[sourceCol] = value;
					} else if (knownFields.has(targetField)) {
						record[targetField] = value;
					}
				}

				// Anything not in the mapping goes into properties — no data is silently dropped
				for (const [col, value] of Object.entries(row)) {
					if (value === '' || mapping[col] !== undefined) continue;
					record.properties[col] = value;
				}

				await crud.create(record);
				created++;
			} catch (error) {
				console.error('[tabularImport] row failed:', error);
				errors++;
			}
		}

		return Response.json({ created, errors });
	}

	// ── Templates ──────────────────────────────────────────────────────────────
	const templatesGetMatch = requestMatch('GET', '/import/tabular/templates', request);

	if (templatesGetMatch) {
		return Response.json(settingsDb.get('importTemplates') ?? []);
	}

	const templatesPostMatch = requestMatch('POST', '/import/tabular/templates', request);

	if (templatesPostMatch) {
		let body;

		try {
			body = await request.json();
		} catch {
			return new Response('Invalid JSON', { status: 400 });
		}

		const { name, collection, mapping } = body;

		if (!name || !collection || !mapping)
			return new Response('name, collection, and mapping are required', { status: 400 });

		const existing = settingsDb.get('importTemplates') ?? [];
		const withoutDupe = existing.filter(t => t.name !== name);
		const template = { name, collection, mapping, createdAt: new Date().toISOString() };

		await settingsDb.set('importTemplates', [...withoutDupe, template]);

		return Response.json(template, { status: 201 });
	}

	const templatesDeleteMatch = requestMatch('DELETE', '/import/tabular/templates/:name', request);

	if (templatesDeleteMatch) {
		const { name } = templatesDeleteMatch;
		const existing = settingsDb.get('importTemplates') ?? [];
		const updated = existing.filter(t => t.name !== decodeURIComponent(name));

		await settingsDb.set('importTemplates', updated);

		return new Response(null, { status: 204 });
	}
};

export default tabularImportRouter;
