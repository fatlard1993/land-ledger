import { describe, expect, test } from 'bun:test';

import { stayOpenFor } from './stayOpenFor';

describe('stayOpenFor', () => {
	test('a failed request is handed back for FormDialog to show', () => {
		const failed = { status: 'error', body: { error: 'Name taken' }, response: { status: 409 } };

		expect(stayOpenFor(failed)).toBe(failed);
	});

	test('a conflict backed out of stays open with nothing to show', () => {
		expect(stayOpenFor({ status: 'success', body: null, success: false })).toBe(false);
	});

	test('a saved or queued write carries on', () => {
		expect(stayOpenFor({ status: 'success', body: {} })).toBeUndefined();
		expect(stayOpenFor({ status: 'success', response: { status: 202 } })).toBeUndefined();
		expect(stayOpenFor(undefined)).toBeUndefined();
	});
});
