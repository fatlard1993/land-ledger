import { readFile } from 'fs/promises';
import { atomicWrite } from './AtomicJSONFile.js';
import { createDebouncedWriter } from './createDebouncedWriter.js';

// Per-collection file-backed store.
// Writes are debounced 100ms so rapid bulk mutations (e.g. importing 200 records)
// coalesce into one disk write per file rather than one per record.

export class CollectionDB {
	isCollectionDB = true; // discriminator used by createCRUD

	data = {};
	path = null;

	// Assigned in init() once the path is known.
	write = null;
	flush = null;

	async init(path) {
		this.path = path;
		try {
			const text = await readFile(path, 'utf-8');
			this.data = JSON.parse(text);
		} catch (e) {
			if (e.code !== 'ENOENT') throw e;
			this.data = {};
		}

		const debouncedWriter = createDebouncedWriter(() => atomicWrite(this.path, this.data));
		this.write = debouncedWriter.write;
		this.flush = debouncedWriter.flush;
	}
}
