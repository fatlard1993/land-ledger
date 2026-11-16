import { describe, expect, test } from 'bun:test';

import { movedRoute, timelineFieldFrom, timelineHref } from './routes.js';

describe('movedRoute', () => {
	test('an old capitalized path opens its view, keeping its query', () => {
		expect(movedRoute('#/Fields')).toBe('#/fields');
		expect(movedRoute('#/Timeline?field=abc')).toBe('#/timeline?field=abc');
	});

	test('a current path, an unknown one and no hash are left alone', () => {
		expect(movedRoute('#/fields')).toBeNull();
		expect(movedRoute('#/Nowhere')).toBeNull();
		expect(movedRoute('')).toBeNull();
	});
});

describe("Timeline's field filter in the address", () => {
	test('is written as a query and read back', () => {
		expect(timelineHref('f 1')).toBe('#/timeline?field=f%201');
		expect(timelineHref()).toBe('#/timeline');
		expect(timelineFieldFrom(timelineHref('f 1'))).toBe('f 1');
		expect(timelineFieldFrom('#/timeline')).toBeNull();
	});
});
