import { createStore } from '@vanilla-bean/components/app';

import archiveDb from './archive';

// A new record stores '' for a field it was given as null, as land-ledger's records always have
const blankNulls = fields => entry => {
	for (const field of Array.isArray(fields) ? fields : Object.keys(fields))
		if (entry[field] === null) entry[field] = '';
};

/**
 * A collection with a file of its own (a CollectionDB). Records are versioned: an update made against an older `_v`
 * throws a ConflictError holding the stored record.
 * @param {Array<string>|object} fields - The fields records keep: names, or the library's map of name to type
 * @param {object} db - Its CollectionDB
 * @returns {object} The store
 */
export const collectionStore = (fields, db) =>
	createStore({ db, fields, versioned: true, hooks: { beforeCreate: blankNulls(fields) } });

// The archive's merged state, as a database createStore can hold a collection of
const archive = {
	get data() {
		return archiveDb.db.data;
	},
	write: () => archiveDb.write(),
};

/**
 * A collection in the archive, written by year. Each change marks the years of the records it touches, so only those
 * year files are rewritten; an update that moves a record's date marks both the year it left and the one it joined.
 * @param {string} collection - Its key in the archive
 * @param {Array<string>|object} fields - The fields records keep: names, or the library's map of name to type
 * @returns {object} The store
 */
export const archiveStore = (collection, fields) =>
	createStore({
		db: archive,
		collection,
		fields,
		versioned: true,
		hooks: {
			beforeCreate: blankNulls(fields),
			beforeWrite: entries => entries.forEach(entry => archiveDb.markDirty(entry)),
		},
	});
