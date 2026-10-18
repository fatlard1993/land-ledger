import { Component, Elem, styled, Button } from '@vanilla-bean/components';
import { nanoid } from 'nanoid';

// crypto.randomUUID needs a secure context, which a plain-http LAN page isn't
const SESSION_ID = nanoid();

// ── Toast ──────────────────────────────────────────────────────────────────────

const SyncToast = styled(
	Component,
	() => `
	position: fixed;
	bottom: 80px;
	left: 50%;
	transform: translateX(-50%);
	background: rgba(20,20,20,0.95);
	color: #fff;
	border-radius: 20px;
	padding: 8px 14px;
	font-size: 13px;
	font-family: system-ui, sans-serif;
	display: none;
	align-items: center;
	gap: 10px;
	z-index: 9999;
	box-shadow: 0 2px 12px rgba(0,0,0,0.5);
	backdrop-filter: blur(4px);
	white-space: nowrap;

	&.visible {
		display: flex;
	}
`,
);

let _toast = null;
let _timer = null;

function getToast() {
	if (_toast) return _toast;

	_toast = new SyncToast({ appendTo: document.body });

	new Elem({ tag: 'span', appendTo: _toast, textContent: 'Updated on another device' });

	new Button({
		appendTo: _toast,
		textContent: 'Refresh',
		style: {
			background: 'rgba(255,255,255,0.15)',
			border: 'none',
			color: 'inherit',
			padding: '3px 10px',
			borderRadius: '10px',
			cursor: 'pointer',
			fontSize: '12px',
		},
		onPointerPress: () => location.reload(),
	});

	new Button({
		appendTo: _toast,
		textContent: '×',
		style: {
			background: 'none',
			border: 'none',
			color: 'rgba(255,255,255,0.5)',
			cursor: 'pointer',
			fontSize: '18px',
			lineHeight: '1',
			padding: '0',
		},
		onPointerPress: () => {
			_toast.removeClass('visible');
			clearTimeout(_timer);
		},
	});

	return _toast;
}

function showToast() {
	getToast().addClass('visible');
	clearTimeout(_timer);
	_timer = setTimeout(() => {
		_toast.removeClass('visible');
	}, 8_000);
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

// Installs the x-client-id fetch wrapper without opening the SSE connection.
// Must run before initOfflineQueue so queued replay requests carry the header.
export function wrapFetch() {
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
