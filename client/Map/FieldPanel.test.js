import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';

import { Component } from '@vanilla-bean/components';

import FieldPanel from './FieldPanel.js';

// Chicago, where a date-only value read as UTC midnight lands on the evening before
describe('FieldPanel, west of Greenwich', () => {
	const zone = process.env.TZ;

	beforeAll(() => (process.env.TZ = 'America/Chicago'));
	afterAll(() => (zone === undefined ? delete process.env.TZ : (process.env.TZ = zone)));

	test('an event shows the day it was logged for', async () => {
		const fetch = spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'));
		const panel = new FieldPanel();
		const field = { id: 'f1', name: 'Creek Bottom' };

		panel._content = new Component({ appendTo: document.body });
		panel._passedEvents = [
			{ id: 'e1', fieldId: 'f1', date: '2026-05-02', season: 2026, category: 'crop', name: 'Planted soybeans' },
			{ id: 'e2', fieldId: 'f1', date: '2026-01-01', category: 'observation', name: 'Walked the drainage' },
		];

		await panel._renderDetails(field);

		const dates = [...panel._content.elem.querySelectorAll('.date')].map(el => el.textContent);

		expect(dates).toContain(new Date(2026, 4, 2).toLocaleDateString());
		expect(dates).toContain(new Date(2026, 0, 1).toLocaleDateString());
		expect(panel._content.elem.textContent).not.toContain('2025');

		panel._content.elem.remove();
		fetch.mockRestore();
	});
});
