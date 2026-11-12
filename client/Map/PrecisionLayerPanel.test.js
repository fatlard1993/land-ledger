import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';

import { Component } from '@vanilla-bean/components';

import { renderPrecisionLayersSection } from './PrecisionLayerPanel.js';

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

const layer = { id: 'l1', fieldId: 'f1', type: 'yield', season: 2026, label: 'Soybeans 2026' };

const confirmButton = text =>
	[...(document.querySelector('dialog[open]')?.querySelectorAll('button') ?? [])].find(
		button => button.textContent === text,
	);

describe('deleting a precision layer', () => {
	let calls;
	let fetch;

	beforeEach(() => {
		calls = [];
		fetch = spyOn(globalThis, 'fetch').mockImplementation(async (url, { method = 'GET' } = {}) => {
			calls.push(`${method} ${url}`);

			if (method === 'GET' && String(url).startsWith('/precision-layers')) return Response.json({ l1: layer });
			if (method === 'DELETE') return new Response(null, { status: 204 });

			return Response.json({});
		});
	});
	afterEach(() => {
		fetch.mockRestore();
		document.body.innerHTML = '';
	});

	const pressDelete = async () => {
		const container = new Component({ appendTo: document.body });

		await renderPrecisionLayersSection({ id: 'f1' }, container);
		container.elem.querySelector('button[title="Delete layer"]').click();

		await waitFor(() => expect(confirmButton('Delete')).toBeTruthy());
	};

	const deletes = () => calls.filter(call => call.startsWith('DELETE'));

	test('asks first, as a danger, naming the layer', async () => {
		await pressDelete();

		const dialog = document.querySelector('dialog[open]');

		expect(dialog.classList.contains('intent-danger')).toBe(true);
		expect(dialog.textContent).toContain('Delete "Soybeans 2026"?');
		expect(deletes()).toEqual([]);
	});

	test('a cancel keeps it', async () => {
		await pressDelete();

		confirmButton('Cancel').click();
		await new Promise(resolve => setTimeout(resolve, 50));

		expect(deletes()).toEqual([]);
	});

	test('Delete deletes it', async () => {
		await pressDelete();

		confirmButton('Delete').click();

		await waitFor(() => expect(deletes()).toEqual(['DELETE /precision-layers/l1']));
	});
});
