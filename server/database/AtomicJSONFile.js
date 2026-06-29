import { writeFile, rename, readFile } from 'fs/promises';

// Drop-in replacement for lowdb's JSONFile adapter.
// Writes via tmp → rename to prevent partial-write corruption on crash.
// If the server dies between writeFile and rename, the original file is
// untouched and the .tmp file is silently overwritten on the next write.

// Exported so other adapters can reuse the same atomic-write primitive
// rather than reimplementing it.
export async function atomicWrite(path, data) {
	const tmp = path + '.tmp';
	await writeFile(tmp, JSON.stringify(data, null, '\t'), 'utf-8');
	await rename(tmp, path); // atomic on POSIX filesystems
}

export class AtomicJSONFile {
	constructor(filename) {
		this.filename = filename;
	}

	async read() {
		try {
			const text = await readFile(this.filename, 'utf-8');
			return JSON.parse(text);
		} catch (e) {
			if (e.code === 'ENOENT') return null; // file doesn't exist yet
			throw e;
		}
	}

	async write(data) {
		await atomicWrite(this.filename, data);
	}
}
