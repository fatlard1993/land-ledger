import { describe, test, expect } from 'bun:test';

import Nav from './Nav.js';

describe('Nav', () => {
	test('each view is a link to its path', () => {
		const nav = new Nav({ appendTo: document.body });
		const links = [...nav.elem.querySelectorAll('a')].map(a => a.getAttribute('href'));

		expect(links).toContain('#/');
		expect(links).toContain('#/fields');
		expect(links).toContain('#/timeline');

		nav.destroy();
	});

	test('its links carry no tooltip', () => {
		const nav = new Nav({ appendTo: document.body });

		expect(nav.elem.querySelectorAll('a').length).toBeGreaterThan(0);
		expect(nav.elem.querySelectorAll('a.has-tooltip').length).toBe(0);

		nav.destroy();
	});

	test('the view on screen is marked current', () => {
		window.location.hash = '#/fields';

		const nav = new Nav({ appendTo: document.body });
		const current = [...nav.elem.querySelectorAll('a[aria-current="page"]')].map(a => a.getAttribute('href'));

		expect(current).toEqual(['#/fields']);

		nav.destroy();
		window.location.hash = '';
	});
});
