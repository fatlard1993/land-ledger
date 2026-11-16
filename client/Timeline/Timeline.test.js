import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import Timeline from './Timeline.js';

describe('Timeline with a field filter', () => {
	let fetch;

	afterEach(() => {
		fetch.mockRestore();
		document.body.innerHTML = '';
	});

	const show = async ({ events, fieldFilter }) => {
		fetch = spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}));

		const view = new Timeline({ appendTo: document.body });

		view.fields = { body: { f1: { id: 'f1', name: 'Creek Bottom' }, f2: { id: 'f2', name: 'Home Forty' } } };
		view.events = { body: events };
		view._fieldFilter = fieldFilter;
		view._renderTimeline();

		return view.content.elem.textContent;
	};

	test('a field with no events is a no-match naming the field, not an empty farm', async () => {
		const text = await show({
			events: { e1: { id: 'e1', fieldId: 'f2', date: '2026-05-02', category: 'crop', name: 'Planted' } },
			fieldFilter: 'f1',
		});

		expect(text).toContain('No events for Creek Bottom');
		expect(text).not.toContain('No events logged yet');
	});

	test('with no filter, no events is the empty state', async () => {
		const text = await show({ events: {}, fieldFilter: null });

		expect(text).toContain('No events logged yet');
	});
});

describe("Timeline's field filter", () => {
	let fetch;

	afterEach(() => {
		fetch.mockRestore();
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '#/');
	});

	test('is read from the address, and picking another writes it there', async () => {
		fetch = spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}));
		window.history.replaceState(null, '', '#/timeline?field=f1');

		const view = new Timeline({ appendTo: document.body });

		view.fields = { body: { f1: { id: 'f1', name: 'Creek Bottom' }, f2: { id: 'f2', name: 'Home Forty' } } };
		view.events = { body: {} };
		view._filterFromAddress();

		expect(view._fieldFilter).toBe('f1');
		expect(view.toolbar.options.heading).toBe('Creek Bottom');

		view._setFieldFilter('f2');

		expect(window.location.hash).toBe('#/timeline?field=f2');
		expect(view.toolbar.options.heading).toBe('Home Forty');

		view._setFieldFilter(null);

		expect(window.location.hash).toBe('#/timeline');
	});
});
