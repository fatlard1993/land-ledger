import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, beforeEach, describe, expect, test } from 'bun:test';

import settingsDb from './database/settings';
import { createSession, destroySession, digest, migrateApiTokens, pruneSessions, resolveSession } from './auth';

const dir = mkdtempSync(join(tmpdir(), 'll-auth-'));
const file = join(dir, 'll-settings.json');
let n = 0;

// A fresh settings file each time, read back from disk as a restart would
const restart = () => settingsDb.init({ path: file });
const withCookie = token => ({ headers: new Map([['cookie', `ll_session=${token}`]]) });
const withBearer = token => ({ headers: new Map([['authorization', `Bearer ${token}`]]) });

beforeEach(async () => {
	rmSync(file, { force: true });
	n++;
	await restart();
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('api tokens', () => {
	test('a token saved in plain text keeps working once migrated, and only its digest is kept', async () => {
		const token = `ll_live_old${n}`;

		await settingsDb.set('apiTokens', [
			{ id: 'a', name: 'scale', roles: { farmhand: true }, token, tokenPrefix: 'll_live_old' },
		]);
		await migrateApiTokens();
		await restart();

		const [stored] = settingsDb.get('apiTokens');

		expect(stored.token).toBeUndefined();
		expect(stored.tokenHash).toBe(digest(token));
		expect(readFileSync(file, 'utf8')).not.toContain(token);
		expect(resolveSession(withBearer(token))?.name).toBe('scale');
		expect(resolveSession(withBearer(`${token}x`))).toBeNull();
	});
});

describe('sessions', () => {
	test('survive a restart, kept by digest; signing out ends them', async () => {
		const token = await createSession({ id: 'admin', name: 'Admin', roles: { admin: true } });

		await restart();

		expect(resolveSession(withCookie(token))?.id).toBe('admin');
		expect(readFileSync(file, 'utf8')).not.toContain(token);

		await destroySession(withCookie(token));
		await restart();

		expect(resolveSession(withCookie(token))).toBeNull();
	});

	test('one that has run out is gone, and dropped from the file', async () => {
		await settingsDb.set('sessions', {
			[digest('stale')]: { id: 'admin', roles: {}, createdAt: Date.now() - 8 * 86400000 },
		});
		await pruneSessions();

		expect(settingsDb.get('sessions')).toEqual({});
		expect(resolveSession(withCookie('stale'))).toBeNull();
	});

	test('a key every object inherits is no session', () => {
		expect(resolveSession(withCookie('constructor'))).toBeNull();
	});
});
