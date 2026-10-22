import { afterAll, beforeAll, describe, expect, setSystemTime, test } from 'bun:test';

import { yearFromRecord } from '../database/YearArchiveAdapter.js';
import { buildHtml, isExpired } from '../router/shared.js';
import { addDays, toDateOnly } from './dates';

// Chicago at 11:30 on an October evening, when the UTC day is already tomorrow; restored after, since the time
// zone and clock are process-wide
describe('server dates, west of Greenwich', () => {
	const zone = process.env.TZ;

	beforeAll(() => {
		process.env.TZ = 'America/Chicago';
		setSystemTime(new Date('2026-10-22T04:30:00Z'));
	});
	afterAll(() => {
		setSystemTime();
		if (zone === undefined) delete process.env.TZ;
		else process.env.TZ = zone;
	});

	test('the run is pinned to a US evening', () => {
		expect(new Date().getDate()).toBe(21);
		expect(new Date().toISOString().slice(0, 10)).toBe('2026-10-22');
	});

	test('today is the server’s local day', () => {
		expect(toDateOnly()).toBe('2026-10-21');
	});

	test('adding days counts calendar days, across DST changes too', () => {
		expect(addDays('2026-10-21', 1)).toBe('2026-10-22');
		expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
		expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
		expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
		expect(addDays('2026-01-15', 283)).toBe('2026-10-25');
		expect(addDays('2026-10-21', -14)).toBe('2026-10-07');
	});

	test('a share link is good through the end of its expiry day', () => {
		expect(isExpired({ expiresAt: '2026-10-21' })).toBe(false);
		expect(isExpired({ expiresAt: '2026-10-20' })).toBe(true);
		expect(isExpired({ expiresAt: '2026-10-22T04:00:00Z' })).toBe(true);
	});

	test('a share page prints date-only values as their own day, and timestamps too', () => {
		const html = buildHtml(
			{ collections: ['applicationLogs'], expiresAt: '2026-11-01T17:00:00Z' },
			{ applicationLogs: [{ date: '2026-10-01' }, { date: '<b>soon</b>' }] },
			{},
		);

		expect(html).toContain('Oct 1, 2026');
		expect(html).toContain('Nov 1, 2026');
		expect(html).not.toContain('Invalid Date');
		expect(html).toContain('&lt;b&gt;soon&lt;/b&gt;');
	});

	test('a record’s year is its local year', () => {
		expect(yearFromRecord({ date: '2026-01-01' })).toBe(2026);
		expect(yearFromRecord({ date: '2027-01-01T03:00:00Z' })).toBe(2026);
		expect(yearFromRecord({})).toBe(2026);
	});
});
