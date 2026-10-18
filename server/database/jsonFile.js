import { DataFile, TextFile } from 'lowdb/node';

// Tab-indented, as land-ledger's files always have been
const stringify = data => JSON.stringify(data, null, '\t');

// A lowdb adapter for one JSON file. lowdb writes through steno: a temporary file, then a rename, one write at a time
export const jsonFile = path => new DataFile(path, { parse: JSON.parse, stringify });

// One writer per file, so two writes to it queue rather than race on its temporary file
const writers = new Map();

export const writeJSON = (path, data) => {
	if (!writers.has(path)) writers.set(path, new TextFile(path));

	return writers.get(path).write(stringify(data));
};
