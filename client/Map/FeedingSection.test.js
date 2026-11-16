import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';

import { Component } from '@vanilla-bean/components';

import { openTreatDialog, renderFeedingSection } from './FeedingSection.js';

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

const schedule = { id: 's1', fieldId: 'f1', feedType: 'Hay', frequency: 'daily' };

const buttonNamed = text => [...document.querySelectorAll('button')].find(button => button.textContent.includes(text));

describe('deleting a feeding log entry', () => {
	let calls;
	let fetch;

	beforeEach(() => {
		calls = [];
		fetch = spyOn(globalThis, 'fetch').mockImplementation(async (url, { method = 'GET', body } = {}) => {
			calls.push({ method, url: String(url), body: body && JSON.parse(body) });

			if (method === 'GET' && String(url).startsWith('/feeding-logs')) return Response.json({ log1: log });
			if (method === 'GET' && String(url).startsWith('/feeding-schedules')) return Response.json({ s1: schedule });
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

describe('a feeding schedule row', () => {
	let fetch;

	beforeEach(() => {
		fetch = spyOn(globalThis, 'fetch').mockImplementation(async url => {
			if (String(url).startsWith('/feeding-schedules')) {
				return Response.json({ s1: schedule });
			}

			return Response.json({});
		});
	});
	afterEach(() => {
		fetch.mockRestore();
		document.body.innerHTML = '';
	});

	test('marks it fed with a flat success button, beside the filled header actions', async () => {
		const container = new Component({ appendTo: document.body });

		await renderFeedingSection({ id: 'f1' }, [], () => {}, container);

		const markFed = container.elem.querySelector('button[title="Mark as fed"]');

		expect(markFed.classList.contains('intent-success')).toBe(true);
		expect(markFed.classList.contains('variant-flat')).toBe(true);
		expect(markFed.style.backgroundColor).toBe('');
	});
});

describe('logging a treat', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	const fieldNamed = (dialog, text) =>
		document.getElementById(
			[...dialog.elem.querySelectorAll('label')].find(label => label.textContent === text).htmlFor,
		);

	const type = (input, value) => {
		input.value = value;
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new Event('change', { bubbles: true }));
	};

	test('says under the field what it needs, then logs it', async () => {
		const fetch = spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ id: 'log9' }));
		const refreshed = [];
		const dialog = openTreatDialog({ id: 'f1' }, 12, () => refreshed.push(true));

		dialog.form.options.data.date = '2026-11-03';
		buttonNamed('Log').click();
		await waitFor(() =>
			expect(fieldNamed(dialog, 'What they got').parentElement.querySelector('.vbc-field-error').textContent).toBe(
				'Fill in what they got',
			),
		);
		expect(fetch).not.toHaveBeenCalled();

		type(fieldNamed(dialog, 'What they got'), 'Range Cake');
		type(fieldNamed(dialog, 'Amount'), '2');
		buttonNamed('Log').click();
		await waitFor(() => expect(refreshed).toHaveLength(1));

		expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
			fieldId: 'f1',
			feedType: 'Range Cake',
			amountPerHead: 2,
			amountUnit: 'lbs/hd',
			headCount: 12,
			type: 'treat',
			date: '2026-11-03',
			notes: '',
		});

		fetch.mockRestore();
	});
});
