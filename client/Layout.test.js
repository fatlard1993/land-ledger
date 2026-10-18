import { describe, test, expect } from 'bun:test';

import { ActionHeader } from './Layout.js';

describe('ActionHeader', () => {
	test('title is the header text, not a tooltip', () => {
		const header = new ActionHeader({ appendTo: document.body, title: 'Inventory' });

		expect(header.elem.textContent).toBe('Inventory');
		expect(header.elem.title).toBe('');
	});

	test('a new title replaces the text', () => {
		const header = new ActionHeader({ appendTo: document.body, title: 'Inventory' });

		header.options.title = 'Budget';

		expect(header.elem.textContent).toBe('Budget');
	});

	test('lays out as a row', () => {
		const header = new ActionHeader({ appendTo: document.body, title: 'Incidents' });

		expect(header.elem.style.display).toBe('flex');
		expect(header.elem.style.justifyContent).toBe('space-between');
	});
});
