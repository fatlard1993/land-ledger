import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, describe, expect, test } from 'bun:test';

import weatherDb from './weather';
import benchmarksDb from './benchmarks';

const dir = mkdtempSync(join(tmpdir(), 'll-cache-'));

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('cache files', () => {
	test('weather days written survive a restart', async () => {
		const path = join(dir, 'weather.json');

		await weatherDb.init({ path });
		await weatherDb.setDays('42,-93', { '2026-05-01': { tempMax: 70 } });
		await weatherDb.setDays('42,-93', { '2026-05-02': { tempMax: 72 } });
		await weatherDb.init({ path });

		expect(weatherDb.getDay('42,-93', '2026-05-01')).toEqual({ tempMax: 70 });
		expect(weatherDb.getDay('42,-93', '2026-05-02')).toEqual({ tempMax: 72 });
		expect(weatherDb.getDay('42,-93', '2026-05-03')).toBeNull();
	});

	test('a benchmark keeps its value and when it was fetched', async () => {
		const path = join(dir, 'benchmarks.json');

		await benchmarksDb.init({ path });
		await benchmarksDb.set('IA|Story|corn|2025', { value: 201 });
		await benchmarksDb.init({ path });

		expect(benchmarksDb.get('IA|Story|corn|2025')).toMatchObject({ value: 201, fetchedAt: expect.any(String) });
	});
});
