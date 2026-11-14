import { describe, expect, test } from 'bun:test';

import { movedRoute } from './routes.js';

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
