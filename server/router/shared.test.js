import { describe, test, expect } from 'bun:test';

import { escHtml, isExpired, filterByScope, buildHtml } from './shared.js';

// ── escHtml ───────────────────────────────────────────────────────────────────

describe('escHtml', () => {
	test('returns em-dash for null/undefined', () => {
		expect(escHtml(null)).toBe('—');
		expect(escHtml(undefined)).toBe('—');
	});

	test('escapes ampersands', () => {
		expect(escHtml('AT&T')).toBe('AT&amp;T');
	});

	test('escapes < and > — prevents tag injection in text content', () => {
		expect(escHtml('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
	});

	test('neutralises a script tag in a field name', () => {
		const result = escHtml('<script>alert(1)</script>');
		expect(result).not.toContain('<script>');
		expect(result).toContain('&lt;script&gt;');
	});

	test('passes through plain strings unchanged', () => {
		expect(escHtml('Whitman County')).toBe('Whitman County');
	});
});

// ── isExpired ─────────────────────────────────────────────────────────────────

describe('isExpired', () => {
	test('returns false when expiresAt is absent', () => {
		expect(isExpired({})).toBe(false);
	});

	test('returns false when expiresAt is in the future', () => {
		const future = new Date(Date.now() + 86_400_000).toISOString();
		expect(isExpired({ expiresAt: future })).toBe(false);
	});

	test('returns true when expiresAt is in the past', () => {
		const past = new Date(Date.now() - 86_400_000).toISOString();
		expect(isExpired({ expiresAt: past })).toBe(true);
	});
});

// ── filterByScope ─────────────────────────────────────────────────────────────

describe('filterByScope', () => {
	const records = [
		{ id: 'r1', fieldId: 'f1', date: '2024-03-01' },
		{ id: 'r2', fieldId: 'f2', date: '2024-06-15' },
		{ id: 'r3', fieldId: 'f1', date: '2024-09-20' },
	];

	test('returns all records when share has no scope', () => {
		expect(filterByScope(records, {})).toHaveLength(3);
	});

	test('filters by fieldIds when specified', () => {
		const result = filterByScope(records, { fieldIds: ['f1'] });
		expect(result).toHaveLength(2);
		expect(result.every(r => r.fieldId === 'f1')).toBe(true);
	});

	test('filters by dateRange.start', () => {
		const result = filterByScope(records, { dateRange: { start: '2024-06-01' } });
		expect(result).toHaveLength(2);
		expect(result.map(r => r.id)).toEqual(['r2', 'r3']);
	});

	test('filters by dateRange.end', () => {
		const result = filterByScope(records, { dateRange: { end: '2024-06-30' } });
		expect(result).toHaveLength(2);
		expect(result.map(r => r.id)).toEqual(['r1', 'r2']);
	});

	test('applies fieldIds and dateRange together', () => {
		const result = filterByScope(records, {
			fieldIds: ['f1'],
			dateRange: { start: '2024-06-01' },
		});
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('r3');
	});

	test('keeps records with no fieldId when fieldIds filter is active', () => {
		const withNoField = [...records, { id: 'r4', date: '2024-01-01' }];
		const result = filterByScope(withNoField, { fieldIds: ['f1'] });
		expect(result.find(r => r.id === 'r4')).toBeDefined();
	});
});

// ── buildHtml ─────────────────────────────────────────────────────────────────

describe('buildHtml', () => {
	const share = {
		name: 'Audit 2024',
		purpose: 'Organic certification',
		collections: [],
	};

	test('returns a valid HTML document string', () => {
		const html = buildHtml(share, {}, {});
		expect(html).toContain('<!DOCTYPE html>');
		expect(html).toContain('</html>');
	});

	test('escapes the share name in the page title', () => {
		const malicious = { ...share, name: '<script>alert(1)</script>' };
		const html = buildHtml(malicious, {}, {});
		expect(html).not.toContain('<script>alert(1)</script>');
		expect(html).toContain('&lt;script&gt;');
	});

	test('escapes field names from applicationLogs in table cells', () => {
		const share2 = { ...share, collections: ['applicationLogs'] };
		const fieldMap = { f1: { name: '<img src=x onerror=alert(1)>' } };
		const data = {
			applicationLogs: [{ fieldId: 'f1', date: '2024-01-01', category: 'herbicide', product: 'Roundup' }],
		};
		const html = buildHtml(share2, data, fieldMap);
		expect(html).not.toContain('<img src=x');
		expect(html).toContain('&lt;img');
	});

	test('shows a fallback message when no collections produce records', () => {
		const html = buildHtml(share, {}, {});
		expect(html).toContain('No records');
	});

	test('renders an application log table when applicationLogs data is present', () => {
		const share2 = { ...share, collections: ['applicationLogs'] };
		const data = {
			applicationLogs: [
				{ fieldId: null, date: '2024-05-01', category: 'herbicide', product: 'Roundup', rate: 22, rateUnit: 'oz/ac' },
			],
		};
		const html = buildHtml(share2, data, {});
		expect(html).toContain('Application Records');
		expect(html).toContain('Roundup');
	});
});
