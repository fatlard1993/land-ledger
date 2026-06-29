import { nanoid } from 'nanoid';

export const createCRUD = (collection, fields, hooks = {}, db) => {
	if (!db) throw new Error(`createCRUD('${collection}'): db argument is required`);

	// CollectionDB: the file IS the collection — access db.data directly.
	// Archive DB (YearArchiveAdapter): data is a sub-key of the merged state.
	const getData = () => (db.isCollectionDB ? db.data : db.db.data[collection]);
	const snapshot = () => JSON.parse(JSON.stringify(getData()));
	const restore = s => {
		if (db.isCollectionDB) db.data = s;
		else db.db.data[collection] = s;
	};

	return {
		get data() {
			return getData();
		},

		async create(data) {
			let id = nanoid(12);
			while (this.data[id]) id = nanoid(12);

			const entry = { ...Object.fromEntries(fields.map(f => [f, data[f] ?? ''])), id, _v: 1 };

			if (hooks.beforeCreate) await hooks.beforeCreate(entry, data);

			const snap = snapshot();
			this.data[id] = entry;

			try {
				db.markDirty?.(entry);
				await db.write();
			} catch (error) {
				restore(snap);
				throw error;
			}

			return entry;
		},

		read({ id } = {}) {
			if (id) return this.data[id] || false;
			return this.data;
		},

		async update({ id, update }) {
			if (!this.data[id]) return false;

			// Optimistic lock: reject if client's version is stale (only when both sides have _v)
			if (update._v !== undefined && this.data[id]._v !== undefined && update._v !== this.data[id]._v) {
				return { _conflict: true, current: this.data[id] };
			}

			if (hooks.beforeUpdate) await hooks.beforeUpdate(update);

			const filtered = Object.fromEntries(fields.map(f => [f, update[f]]).filter(([, v]) => v !== undefined));
			const prev = this.data[id];
			this.data[id] = { ...prev, ...filtered, _v: (prev._v || 0) + 1 };

			try {
				// Mark both the old and new year dirty — the date field can change on
				// update (e.g. correcting a logged date), which moves the record between
				// year files. Marking both ensures neither year file goes stale.
				db.markDirty?.(prev);
				db.markDirty?.(this.data[id]);
				await db.write();
			} catch (error) {
				this.data[id] = prev;
				throw error;
			}

			return this.data[id];
		},

		async delete({ id, ...options }) {
			if (!this.data[id]) return false;

			const toDelete = this.data[id]; // capture year info before removal
			const snap = snapshot();
			delete this.data[id];

			try {
				if (hooks.afterDelete) await hooks.afterDelete(id, options);
				db.markDirty?.(toDelete);
				await db.write();
			} catch (error) {
				restore(snap);
				throw error;
			}

			return id;
		},
	};
};
