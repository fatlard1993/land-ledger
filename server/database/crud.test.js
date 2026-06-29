import { describe, test, expect, mock } from 'bun:test';

import { createCRUD } from './crud.js';

const FIELDS = ['name', 'value'];

// Minimal CollectionDB-shaped stub — just enough for crud.js to work.
const makeDb = (writeImpl = async () => {}) => ({
	isCollectionDB: true,
	data: {},
	write: mock(writeImpl),
	markDirty: mock(() => {}),
});

describe('createCRUD', () => {
	test('throws when db is not provided', () => {
		expect(() => createCRUD('things', FIELDS)).toThrow();
	});
});

describe('create', () => {
	test('returns a new record with a generated id and _v of 1', async () => {
		const db = makeDb();
		const crud = createCRUD('things', FIELDS, {}, db);

		const record = await crud.create({ name: 'foo', value: 'bar' });

		expect(record.id).toBeDefined();
		expect(record.name).toBe('foo');
		expect(record.value).toBe('bar');
		expect(record._v).toBe(1);
	});

	test('populates missing fields with empty strings', async () => {
		const db = makeDb();
		const crud = createCRUD('things', FIELDS, {}, db);

		const record = await crud.create({ name: 'foo' });

		expect(record.value).toBe('');
	});

	test('stores the record in the db', async () => {
		const db = makeDb();
		const crud = createCRUD('things', FIELDS, {}, db);

		const record = await crud.create({ name: 'foo' });

		expect(db.data[record.id]).toEqual(record);
	});

	test('rolls back the record if write throws', async () => {
		const db = makeDb(async () => {
			throw new Error('disk full');
		});
		const crud = createCRUD('things', FIELDS, {}, db);

		await expect(crud.create({ name: 'foo' })).rejects.toThrow('disk full');
		expect(Object.keys(db.data)).toHaveLength(0);
	});
});

describe('read', () => {
	test('returns all records when called without arguments', async () => {
		const db = makeDb();
		const crud = createCRUD('things', FIELDS, {}, db);

		await crud.create({ name: 'a' });
		await crud.create({ name: 'b' });

		expect(Object.keys(crud.read())).toHaveLength(2);
	});

	test('returns a specific record by id', async () => {
		const db = makeDb();
		const crud = createCRUD('things', FIELDS, {}, db);

		const created = await crud.create({ name: 'x' });

		expect(crud.read({ id: created.id })).toEqual(created);
	});

	test('returns false for an unknown id', async () => {
		const db = makeDb();
		const crud = createCRUD('things', FIELDS, {}, db);

		expect(crud.read({ id: 'nope' })).toBe(false);
	});
});

describe('update', () => {
	test('merges changed fields and increments _v', async () => {
		const db = makeDb();
		const crud = createCRUD('things', FIELDS, {}, db);

		const created = await crud.create({ name: 'foo', value: 'bar' });
		const updated = await crud.update({ id: created.id, update: { name: 'baz', _v: 1 } });

		expect(updated.name).toBe('baz');
		expect(updated.value).toBe('bar'); // unchanged
		expect(updated._v).toBe(2);
	});

	test('returns false for an unknown id', async () => {
		const db = makeDb();
		const crud = createCRUD('things', FIELDS, {}, db);

		expect(await crud.update({ id: 'ghost', update: { name: 'x' } })).toBe(false);
	});

	test('returns a conflict object when the client version is stale', async () => {
		const db = makeDb();
		const crud = createCRUD('things', FIELDS, {}, db);

		const created = await crud.create({ name: 'original' }); // _v = 1
		const result = await crud.update({ id: created.id, update: { name: 'new', _v: 99 } });

		expect(result._conflict).toBe(true);
		expect(result.current).toEqual(created);
	});

	test('rolls back to the previous value if write throws', async () => {
		let calls = 0;
		const db = makeDb(async () => {
			if (++calls > 1) throw new Error('disk full');
		});
		const crud = createCRUD('things', FIELDS, {}, db);

		const created = await crud.create({ name: 'original' });

		await expect(crud.update({ id: created.id, update: { name: 'new', _v: 1 } })).rejects.toThrow();
		expect(db.data[created.id].name).toBe('original');
	});
});

describe('delete', () => {
	test('removes the record and returns its id', async () => {
		const db = makeDb();
		const crud = createCRUD('things', FIELDS, {}, db);

		const created = await crud.create({ name: 'going' });
		const result = await crud.delete({ id: created.id });

		expect(result).toBe(created.id);
		expect(db.data[created.id]).toBeUndefined();
	});

	test('returns false for an unknown id', async () => {
		const db = makeDb();
		const crud = createCRUD('things', FIELDS, {}, db);

		expect(await crud.delete({ id: 'ghost' })).toBe(false);
	});

	test('rolls back the deletion if write throws', async () => {
		let calls = 0;
		const db = makeDb(async () => {
			if (++calls > 1) throw new Error('disk full');
		});
		const crud = createCRUD('things', FIELDS, {}, db);

		const created = await crud.create({ name: 'dontlose' });

		await expect(crud.delete({ id: created.id })).rejects.toThrow();
		expect(db.data[created.id]).toBeDefined();
	});
});
