import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import settingsDb from '../database/settings';
import authRouter from './auth';

const dir = mkdtempSync(join(tmpdir(), 'll-login-'));
const server = { requestIP: request => ({ address: request.headers.get('x-test-address') }) };

const login = async (address, passkey) => {
	const started = Date.now();
	const response = await authRouter(
		new Request('http://localhost/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-test-address': address },
			body: JSON.stringify({ passkey }),
		}),
		server,
	);

	return { status: response.status, ms: Date.now() - started };
};

beforeAll(async () => {
	await settingsDb.init({ path: join(dir, 'll-settings.json') });
	await settingsDb.set('accounts', [
		{ id: 'admin', name: 'Admin', passkey: await Bun.password.hash('right', { algorithm: 'bcrypt', cost: 4 }), roles: { admin: true } },
	]);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('login', () => {
	test("one address's wrong passkeys slow only that address", async () => {
		await login('10.0.0.1', 'wrong');
		await login('10.0.0.1', 'wrong');

		const other = await login('10.0.0.2', 'right');
		const guesser = await login('10.0.0.1', 'right');

		expect(other.status).toBe(204);
		expect(other.ms).toBeLessThan(500);
		expect(guesser.status).toBe(204);
		expect(guesser.ms).toBeGreaterThanOrEqual(700);
	});

	test('a right passkey clears the address, so its next try has no delay', async () => {
		await login('10.0.0.3', 'wrong');
		await login('10.0.0.3', 'right');

		expect((await login('10.0.0.3', 'right')).ms).toBeLessThan(200);
	});
});
