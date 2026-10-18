import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { ConflictError } from '@vanilla-bean/components/app';

import archiveDb from './archive';
import { CollectionDB } from './CollectionDB';
import { archiveStore, collectionStore } from './store';

let dir;

beforeAll(async () => {
	dir = mkdtempSync(join(tmpdir(), 'll-store-'));
	await archiveDb.init({ path: join(dir, 'll-archive.json') });
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('collectionStore', () => {
	const fresh = async () => {
		const db = new CollectionDB();

		await db.init(join(dir, `things-${Math.random()}.json`));

		return { db, things: collectionStore(['name', 'value'], db) };
	};

	test('a record keeps its fields in order, then its id and version; a missing or null field is ""', async () => {
		const { things } = await fresh();
		const record = await things.create({ value: null, extra: 'dropped' });

		expect(Object.keys(record)).toEqual(['name', 'value', 'id', '_v']);
		expect(record).toMatchObject({ name: '', value: '', _v: 1 });
	});

	test('the file is the collection, tab-indented', async () => {
		const { db, things } = await fresh();
		const { id } = await things.create({ name: 'Barn' });

		await db.flush();

		expect(readFileSync(db.path, 'utf8')).toBe(JSON.stringify(things.read(), null, '\t'));
		expect(JSON.parse(readFileSync(db.path, 'utf8'))[id].name).toBe('Barn');
	});

	test('an update made against an older version is a conflict carrying the stored record', async () => {
		const { things } = await fresh();
		const { id } = await things.create({ name: 'Barn' });

		await things.update({ id, update: { name: 'Shed', _v: 1 } });

		const stale = await things.update({ id, update: { name: 'Coop', _v: 1 } }).catch(error => error);

		expect(stale).toBeInstanceOf(ConflictError);
		expect(stale.current).toMatchObject({ name: 'Shed', _v: 2 });
	});

	test('only its own records answer to an id', async () => {
		const { things } = await fresh();

		for (const id of ['__proto__', 'constructor', 'toString', '']) {
			expect(things.read({ id })).toBe(false);
			expect(await things.update({ id, update: { name: 'x' } })).toBe(false);
			expect(await things.delete({ id })).toBe(false);
		}
	});
});

describe('archiveStore', () => {
	const yearFiles = () => readdirSync(dir).filter(file => /ll-archive-\d{4}\.json$/.test(file));
	const year = y => JSON.parse(readFileSync(join(dir, `ll-archive-${y}.json`), 'utf8'));

	test("a record lands in its date's year file; moving its date moves it, and deleting removes it", async () => {
		const incidents = archiveStore('incidents', ['date', 'description']);
		const { id } = await incidents.create({ date: '2024-05-02', description: 'hail' });

		await archiveDb.flush();
		expect(yearFiles()).toContain('ll-archive-2024.json');
		expect(year(2024).incidents[id].description).toBe('hail');

		await incidents.update({ id, update: { date: '2025-01-03' } });
		await archiveDb.flush();
		expect(year(2024).incidents[id]).toBeUndefined();
		expect(year(2025).incidents[id].date).toBe('2025-01-03');

		await incidents.delete({ id });
		await archiveDb.flush();
		expect(year(2025).incidents[id]).toBeUndefined();
	});
});
