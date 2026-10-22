import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { formatDate, parseDate } from '@vanilla-bean/components';

import { daysAgo, daysAgoLabel, toDateOnly } from './dates';

// Chicago, where UTC midnight is the evening before; restored after, since the time zone is process-wide
describe('dates, west of Greenwich', () => {
	const zone = process.env.TZ;

	beforeAll(() => (process.env.TZ = 'America/Chicago'));
	afterAll(() => (zone === undefined ? delete process.env.TZ : (process.env.TZ = zone)));

	test('the run is pinned to a US time zone', () => {
		expect(new Date('2026-10-18T00:00:00Z').getDate()).toBe(17);
	});

	test('a date-only value is that calendar day, not the day before', () => {
		expect(parseDate('2026-10-18').getDate()).toBe(18);
		expect(formatDate('2026-10-18')).toBe(new Date(2026, 9, 18).toLocaleDateString());
		expect(formatDate('2026-03-01', { locale: 'en-US', month: 'numeric', day: 'numeric' })).toBe('3/1');
	});

	test('a full timestamp keeps its instant', () => {
		expect(parseDate('2026-10-18T15:30:00Z').toISOString()).toBe('2026-10-18T15:30:00.000Z');
	});

	test('missing and unreadable values', () => {
		expect(formatDate('')).toBe('');
		expect(formatDate(null) || '—').toBe('—');
		expect(formatDate('soon')).toBe('soon');
	});

	test('days ago counts calendar days, late in the evening and across a DST change', () => {
		const lateToday = new Date(2026, 9, 18, 21, 0);

		expect(daysAgo('2026-10-18', lateToday)).toBe(0);
		expect(daysAgoLabel('2026-10-17', lateToday)).toBe('yesterday');
		expect(daysAgoLabel('2026-10-11', lateToday)).toBe('7d ago');
		expect(daysAgo('2026-11-01', new Date(2026, 10, 2, 9))).toBe(1);
	});

	test('today as a date-only value is the local day, late in the evening', () => {
		expect(toDateOnly(new Date(2026, 9, 18, 21, 0))).toBe('2026-10-18');
		expect(toDateOnly(new Date(2026, 0, 5))).toBe('2026-01-05');
	});
});
