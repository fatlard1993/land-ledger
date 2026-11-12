import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';

import { Component } from '@vanilla-bean/components';

import { renderFeedingSection } from './FeedingSection.js';

// Retries an assertion until it holds, or fails with its last error once the time is up
const waitFor = async (assertion, { timeout = 1000 } = {}) => {
	const end = Date.now() + timeout;

	for (;;) {
		try {
			return assertion();
		} catch (error) {
			if (Date.now() > end) throw error;
			await new Promise(resolve => setTimeout(resolve, 20));
		}
	}
};

const log = {
	id: 'log1',
	_v: 2,
	fieldId: 'f1',
	feedType: 'Hay — Grass',
	amountPerHead: 20,
	amountUnit: 'lbs/hd',
	headCount: 12,
	type: 'treat',
	date: '2026-11-01',
	notes: 'Cold snap',
};

const buttonNamed = text => [...document.querySelectorAll('button')].find(button => button.textContent.includes(text));

describe('deleting a feeding log entry', () => {
	let calls;
	let fetch;

	beforeEach(() => {
		calls = [];
		fetch = spyOn(globalThis, 'fetch').mockImplementation(async (url, { method = 'GET', body } = {}) => {
			calls.push({ method, url: String(url), body: body && JSON.parse(body) });

			if (method === 'GET' && String(url).startsWith('/feeding-logs')) return Response.json({ log1: log });
			if (method === 'DELETE') return new Response(null, { status: 204 });

			return Response.json({});
		});
	});
	afterEach(() => {
		fetch.mockRestore();
		document.body.innerHTML = '';
	});

	test('happens on the press, with no confirm, and a toast whose Undo puts the entry back', async () => {
		const container = new Component({ appendTo: document.body });
		let refreshes = 0;

		await renderFeedingSection({ id: 'f1' }, [], () => refreshes++, container);

		container.elem.querySelector('button[title="Delete this log entry"]').click();

		await waitFor(() => expect(buttonNamed('Undo')).toBeTruthy());
		expect(calls.some(({ method, url }) => method === 'DELETE' && url.includes('/feeding-logs/log1'))).toBe(true);
		expect(document.querySelector('dialog[open]')).toBeNull();
		expect(refreshes).toBe(1);

		buttonNamed('Undo').click();

		await waitFor(() => expect(refreshes).toBe(2));

		const { body } = calls.find(({ method }) => method === 'POST');
		const { id, _v, ...fields } = log;

		expect(body).toEqual(fields);
	});
});
