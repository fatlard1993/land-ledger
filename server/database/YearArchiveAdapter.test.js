import { describe, test, expect } from 'bun:test';

import { yearFromRecord } from './YearArchiveAdapter.js';

describe('yearFromRecord', () => {
	test('extracts year from a date field', () => {
		expect(yearFromRecord({ date: '2024-03-15' })).toBe(2024);
	});

	test('extracts year from a breedingDate field when date is absent', () => {
		expect(yearFromRecord({ breedingDate: '2022-06-01' })).toBe(2022);
	});

	test('uses a numeric season field directly', () => {
		expect(yearFromRecord({ season: 2023 })).toBe(2023);
	});

	test('ignores a string season and falls back to the date field', () => {
		expect(yearFromRecord({ season: '2023', date: '2021-01-01' })).toBe(2021);
	});

	test('prefers season over date when season is a valid number', () => {
		expect(yearFromRecord({ season: 2020, date: '2024-01-01' })).toBe(2020);
	});

	test('falls back to current year when no date fields are present', () => {
		expect(yearFromRecord({})).toBe(new Date().getFullYear());
	});

	test('falls back to current year when date is not a valid date string', () => {
		expect(yearFromRecord({ date: 'not-a-date' })).toBe(new Date().getFullYear());
	});

	test('falls back to current year when date is null', () => {
		expect(yearFromRecord({ date: null })).toBe(new Date().getFullYear());
	});
});
