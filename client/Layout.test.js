import { describe, test, expect } from 'bun:test';

import { ActionHeader, EmptyState } from './Layout.js';

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

describe('EmptyState', () => {
	test('shows its icon, title and subtitle', () => {
		const empty = new EmptyState({
			appendTo: document.body,
			icon: '⚠️',
			title: 'No incidents recorded',
			subtitle: 'Incidents are logged from the map',
		});

		expect(empty.elem.textContent).toBe('⚠️No incidents recordedIncidents are logged from the map');
		expect(empty.elem.title).toBe('');
	});
});
