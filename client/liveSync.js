import { Notify } from '@vanilla-bean/components';
import { nanoid } from 'nanoid';

// crypto.randomUUID needs a secure context, which a plain-http LAN page isn't
const SESSION_ID = nanoid();

// ── Toast ──────────────────────────────────────────────────────────────────────

let _toast = null;

// One toast however many changes arrive while it's up
function showToast() {
	if (_toast?.elem.isConnected) return;

	_toast = new Notify({
		intent: 'info',
		timeout: 8_000,
		content: 'Updated on another device',
		actions: [{ textContent: 'Refresh', onPointerPress: () => location.reload() }],
	});
}

// ── SSE connection ─────────────────────────────────────────────────────────────

let source = null;

function connect() {
	if (source) source.close();
	source = new EventSource(`/changes?clientId=${SESSION_ID}`);

	source.onmessage = e => {
		try {
			const msg = JSON.parse(e.data);
			if (msg.type === 'presence') {
				document.dispatchEvent(new CustomEvent('livesync:presence', { detail: msg }));
			} else {
				if (msg.id) document.dispatchEvent(new CustomEvent('livesync:change', { detail: msg }));
				showToast();
			}
		} catch {}
	};

	source.onerror = () => {
		// EventSource.CLOSED (2) means the browser won't auto-retry — reconnect manually
		if (source.readyState === EventSource.CLOSED) setTimeout(connect, 5_000);
	};
}

let fetchWrapped = false;

// Installs the x-client-id fetch wrapper without opening the SSE connection.
// Must run before initOfflineQueue so queued replay requests carry the header.
// A wrapper on fetch itself, not hypertether's beforeRequest: the raw fetch calls and the offline queue's replays
// need the header too, and they don't go through hypertether.
export function wrapFetch() {
	if (fetchWrapped) return;
	fetchWrapped = true;

	const _fetch = globalThis.fetch;
	globalThis.fetch = (url, init = {}) => {
		const headers = new Headers(init.headers ?? {});
		headers.set('x-client-id', SESSION_ID);
		return _fetch(url, { ...init, headers });
	};
}

export function initLiveSync() {
	wrapFetch();
	connect();
}
