import { Notify } from '@vanilla-bean/components';

const DEFAULT_QUEUE_KEY = 'land-ledger-offline-queue';

let _onStateChange = null;
let _queueKey = DEFAULT_QUEUE_KEY;

// ── Queue storage ──────────────────────────────────────────────────────────────

const queue = {
	get() {
		try {
			return JSON.parse(localStorage.getItem(_queueKey) || '[]');
		} catch {
			return [];
		}
	},
	save(entries) {
		localStorage.setItem(_queueKey, JSON.stringify(entries));
	},
	add(entry) {
		const updated = [...this.get(), { ...entry, timestamp: Date.now() }];

		this.save(updated);
		_onStateChange?.({ pending: updated.length, syncing: false, synced: null });
	},
	clear() {
		localStorage.removeItem(_queueKey);
	},
};

// ── Snapshot capture ───────────────────────────────────────────────────────────
// At PATCH queue time we capture the record's current state from the SW cache.
// This gives us the base state needed to detect whether the server diverged
// before we try to apply the mutation on reconnect.

const originalFetch = window.fetch.bind(window);

async function captureSnapshot(url) {
	try {
		// /events/abc123 → fetch /events (collection, likely cached by SW), extract abc123
		const parts = url.split('/').filter(Boolean);
		const id = parts.pop();
		const collectionUrl = '/' + parts.join('/');

		if (!id || !collectionUrl || collectionUrl === '/') return null;

		const res = await originalFetch(collectionUrl);

		if (!res.ok) return null;

		const collection = await res.json();

		return collection[id] ?? null;
	} catch {
		return null;
	}
}

// ── Conflict detection ─────────────────────────────────────────────────────────
// For a PATCH entry with a snapshot: compare the snapshot against the current
// server state. Fields that changed on the server while we were offline are
// conflicts the user needs to resolve.

async function detectConflicts(entry) {
	if (entry.method !== 'PATCH' || !entry.snapshot) return null;

	let current;

	try {
		const res = await originalFetch(entry.url);

		if (!res.ok) return null; // deleted on server — let the PATCH fail naturally

		current = await res.json();
	} catch {
		return null;
	}

	const patchBody = JSON.parse(entry.body || '{}');
	const conflictingFields = [];

	for (const [key, ourValue] of Object.entries(patchBody)) {
		if (key === 'id') continue;

		const snapshotValue = entry.snapshot[key];
		const serverValue = current[key];

		// Conflict = server changed this field from what we had when we went offline
		if (JSON.stringify(snapshotValue) !== JSON.stringify(serverValue)) {
			conflictingFields.push({ key, snapshotValue, serverValue, ourValue });
		}
	}

	return conflictingFields.length ? { entry, current, conflictingFields } : null;
}

// ── Sync ───────────────────────────────────────────────────────────────────────

let _flushing = false;

async function flushQueue() {
	if (_flushing) return;

	const pending = queue.get();

	if (!pending.length) return;

	_flushing = true;

	_onStateChange?.({ pending: pending.length, syncing: true, synced: null });

	// Check each PATCH entry for conflicts before applying anything
	const conflicts = [];
	const toApply = [];

	for (const entry of pending) {
		const conflict = await detectConflicts(entry);

		if (conflict) conflicts.push(conflict);
		else toApply.push(entry);
	}

	// If conflicts exist, pause and ask the user to resolve them
	if (conflicts.length) {
		_onStateChange?.({ pending: pending.length, syncing: false, synced: null });

		const { showConflictDialog } = await import('./ConflictDialog.js');
		const resolutions = await showConflictDialog(conflicts);

		if (resolutions === null) {
			// User cancelled — leave everything in the queue for next attempt
			_flushing = false;
			_onStateChange?.({ pending: pending.length, syncing: false, synced: null });
			return;
		}

		for (const { entry, body } of resolutions) {
			// body === null means the user chose "theirs" for every field — discard
			if (body !== null) toApply.push({ ...entry, body });
		}

		_onStateChange?.({ pending: toApply.length, syncing: true, synced: null });
	}

	// Apply all safe / resolved entries
	let synced = 0;
	const remaining = [];

	for (const entry of toApply) {
		try {
			// Use window.fetch (the current wrapped version) so x-client-id is injected,
			// preventing the server from echoing these replayed writes back to this tab.
			const res = await window.fetch(entry.url, {
				method: entry.method,
				headers: entry.headers ?? {},
				body: entry.body ?? undefined,
			});

			// 2xx / 4xx = consumed (4xx = bad request, no point retrying)
			if (res.status < 500) {
				// PATCH to a gone record — the edit is discarded; tell the user
				if (res.status === 404 && entry.method === 'PATCH') {
					new Notify({
						type: 'warning',
						textContent: 'A queued edit was discarded — the record was deleted while you were offline.',
						timeout: 6000,
					});
				} else if (res.status === 200 && entry.method === 'PATCH') {
					// Server-side optimistic lock conflict: returns 200 { _conflict: true } when
					// another session updated the record between queue time and replay.
					try {
						const json = await res.clone().json();
						if (json._conflict) {
							new Notify({
								type: 'warning',
								textContent:
									'A queued edit was discarded — the same record was changed on another device while you were offline.',
								timeout: 6000,
							});
						}
					} catch {}
				}
				synced++;
			} else {
				remaining.push(entry);
			}
		} catch {
			remaining.push(entry);
		}
	}

	queue.save(remaining);
	_flushing = false;

	_onStateChange?.({ pending: remaining.length, syncing: false, synced });

	if (synced > 0) {
		// Notify views so they can refresh their data; the offline indicator
		// shows a "Refresh" button for the user to reload when ready.
		window.dispatchEvent(new CustomEvent('land-ledger:queue-flushed', { detail: { synced } }));
	}
}

// ── Header serialization ───────────────────────────────────────────────────────
// Headers instances don't survive JSON.stringify (they serialize to {}).
// Flatten to a plain object so x-client-id (injected by liveSync) is preserved
// through the localStorage round-trip and replayed correctly on flush.

function serializeHeaders(headers) {
	if (!headers) return {};
	if (headers instanceof Headers) {
		const obj = {};
		for (const [k, v] of headers.entries()) obj[k] = v;
		return obj;
	}
	return headers;
}

// ── Fetch interception ─────────────────────────────────────────────────────────

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

window.fetch = async (url, options = {}) => {
	const method = (options.method || 'GET').toUpperCase();
	const urlStr = typeof url === 'string' ? url : url.toString();

	// Only intercept same-origin API mutations — pass through GETs, external URLs, SW
	if (!MUTATIONS.has(method) || !urlStr.startsWith('/')) {
		return originalFetch(url, options);
	}

	if (!navigator.onLine) {
		// Capture the record's current state from SW cache so we can detect
		// conflicts when we reconnect and the server has moved on.
		const snapshot = method === 'PATCH' ? await captureSnapshot(urlStr) : null;

		queue.add({
			url: urlStr,
			method,
			headers: serializeHeaders(options.headers),
			body: options.body ?? null,
			snapshot,
		});
		new Notify({ type: 'warning', textContent: 'Offline — change queued, will sync when reconnected', timeout: 4000 });
		return new Response(null, { status: 202 });
	}

	try {
		return await originalFetch(url, options);
	} catch (error) {
		// TypeError = network failure even though navigator.onLine said true
		if (error instanceof TypeError) {
			const snapshot = method === 'PATCH' ? await captureSnapshot(urlStr) : null;

			queue.add({
				url: urlStr,
				method,
				headers: serializeHeaders(options.headers),
				body: options.body ?? null,
				snapshot,
			});
			new Notify({
				type: 'warning',
				textContent: 'Offline — change queued, will sync when reconnected',
				timeout: 4000,
			});
			return new Response(null, { status: 202 });
		}
		throw error;
	}
};

// ── Connectivity events ────────────────────────────────────────────────────────

window.addEventListener('online', () => {
	_onStateChange?.({ pending: queue.get().length, syncing: false, synced: null });
	flushQueue();
});

window.addEventListener('offline', () => {
	_onStateChange?.({ pending: queue.get().length, syncing: false, synced: null });
});

// ── Init ───────────────────────────────────────────────────────────────────────

export function initOfflineQueue(onStateChange, userId = null) {
	_onStateChange = onStateChange;
	if (userId) _queueKey = `${DEFAULT_QUEUE_KEY}-${userId}`;

	// Emit initial state on load
	const pending = queue.get();

	if (pending.length) {
		onStateChange({ pending: pending.length, syncing: false, synced: null });

		// If we have queued items and we're online, flush immediately
		if (navigator.onLine) flushQueue();
	}
}
