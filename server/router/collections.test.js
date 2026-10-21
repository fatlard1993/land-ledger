import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { serve } from '@vanilla-bean/components/app';

import database from '../database/database';
import archiveDb from '../database/archive';
import router from './router';
import { withExpectedDueDate, withWithdrawalDate } from './collections';

let dir;
const call = async (method, path, body) => {
	const response = await router(
		new Request(`http://localhost${path}`, {
			method,
			headers: { 'content-type': 'application/json' },
			...(body && { body: JSON.stringify(body) }),
		}),
	);

	return { status: response.status, body: response.status === 204 ? null : await response.json().catch(() => null) };
};

beforeAll(async () => {
	dir = mkdtempSync(join(tmpdir(), 'll-collections-'));
	await database.init({ path: join(dir, 'll.json') });
	await archiveDb.init({ path: join(dir, 'll-archive.json') });
});

afterAll(async () => {
	await Promise.all([database.flush(), archiveDb.flush()]);
	rmSync(dir, { recursive: true, force: true });
});

describe('collections', () => {
	test('every collection lists, creates, reads, updates and deletes at its path', async () => {
		for (const path of ['/fields', '/incidents', '/budget-items', '/health-records', '/breeding-records']) {
			const created = await call('POST', path, { date: '2025-05-01', name: 'x' });

			expect(created.status).toBe(201);
			expect((await call('GET', path)).body[created.body.id]).toBeDefined();
			expect((await call('GET', `${path}/${created.body.id}`)).body.id).toBe(created.body.id);
			expect((await call('PATCH', `${path}/${created.body.id}`, { name: 'y', _v: 1 })).body._v).toBe(2);
			expect((await call('DELETE', `${path}/${created.body.id}`)).status).toBe(204);
			expect((await call('GET', `${path}/${created.body.id}`)).status).toBe(404);
		}
	});

	test('a stale update answers 409 with { _conflict, current }, which the conflict dialog reads', async () => {
		const { body } = await call('POST', '/fields', { name: 'North 40' });

		await call('PATCH', `/fields/${body.id}`, { name: 'North Forty', _v: 1 });

		const stale = await call('PATCH', `/fields/${body.id}`, { name: 'Stale', _v: 1 });

		expect(stale.status).toBe(409);
		expect(stale.body._conflict).toBe(true);
		expect(stale.body.current.name).toBe('North Forty');
	});

	test('a key every object inherits is no record', async () => {
		expect((await call('GET', '/fields/__proto__')).status).toBe(404);
		expect((await call('PATCH', '/fields/toString', { name: 'x' })).status).toBe(404);
		expect((await call('DELETE', '/incidents/constructor')).status).toBe(404);
	});
});

describe('derived fields', () => {
	test("a breeding date without a due date gets one from the dam's gestation", async () => {
		const dam = (await call('POST', '/animals', { name: 'Bessie', species: 'Cattle' })).body;
		const { body } = await call('POST', '/breeding-records', { damId: dam.id, breedingDate: '2025-05-01' });

		expect(body.expectedDueDate).toBe('2026-02-08');
		expect(withExpectedDueDate({ breedingDate: '2025-05-01', expectedDueDate: '2025-12-25' }).expectedDueDate).toBe(
			'2025-12-25',
		);
		expect(withExpectedDueDate({ breedingDate: '2025-05-01' }).expectedDueDate).toBe('2025-09-28');
	});

	test('a withdrawal date follows from the date and the withdrawal days, and clears without them', async () => {
		const { body } = await call('POST', '/health-records', { date: '2025-06-01', withdrawalDays: 7 });

		expect(body.withdrawalDate).toBe('2025-06-08');
		expect(withWithdrawalDate({ date: '2025-06-01' }).withdrawalDate).toBe('');
	});
});

describe('the router, served', () => {
	const DomResponse = globalThis.Response;
	const nodeEnv = process.env.NODE_ENV;
	let server;

	beforeAll(async () => {
		// Not development, where serve would build and watch the client; Bun.serve answers only its own Response, which the test DOM replaces
		process.env.NODE_ENV = 'production';
		globalThis.Response = (await Bun.fetch('data:,')).constructor;
		server = await serve({ port: 0, router });
	});

	afterAll(() => {
		server.stop(true);
		process.env.NODE_ENV = nodeEnv;
		globalThis.Response = DomResponse;
	});

	const request = (path, init = {}) =>
		Bun.fetch(`http://localhost:${server.port}${path}`, {
			...init,
			headers: { 'content-type': 'application/json', ...init.headers },
		});

	test("another site's page can't write, though a script with no Origin can", async () => {
		const write = { method: 'POST', body: JSON.stringify({ name: 'x' }) };

		expect((await request('/fields', { ...write, headers: { origin: 'https://evil.example' } })).status).toBe(403);
		expect((await request('/fields', write)).status).toBe(201);
	});

	test('the page always revalidates; a file that is gone is a 404, not the page', async () => {
		expect((await request('/')).headers.get('cache-control')).toBe('no-cache');
		expect((await request('/chunk-from-last-build.js')).status).toBe(404);
	});

	test('a body that is not JSON answers 400, an unknown write 404', async () => {
		expect((await request('/fields', { method: 'POST', body: '{bad' })).status).toBe(400);
		expect((await request('/nowhere', { method: 'POST', body: '{}' })).status).toBe(404);
	});
});
