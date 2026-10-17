import { requestMatch } from '@vanilla-bean/components/app';

import { clearClientPresence } from './presence';

const clients = new Map(); // clientId → ReadableStreamDefaultController
const enc = new TextEncoder();

export const broadcastChange = (collection, entityId, excludeClientId = null) => {
	if (!clients.size) return;
	const payload = enc.encode(`data: ${JSON.stringify({ collection, id: entityId })}\n\n`);
	for (const [id, controller] of clients) {
		if (id === excludeClientId) continue;
		try {
			controller.enqueue(payload);
		} catch {
			clients.delete(id);
		}
	}
};

// Presence events carry a type field so clients can distinguish them from change events.
// Sent to all connected clients; each filters by collection+id for their open entity.
export const broadcastPresence = (collection, id, count) => {
	if (!clients.size) return;
	const payload = enc.encode(`data: ${JSON.stringify({ type: 'presence', collection, id, count })}\n\n`);
	for (const [, controller] of clients) {
		try {
			controller.enqueue(payload);
		} catch {
			/* stale controller — will be removed on next broadcastChange */
		}
	}
};

const changesRouter = request => {
	if (!requestMatch('GET', '/changes', request)) return null;

	const clientId = new URL(request.url).searchParams.get('clientId') || crypto.randomUUID();

	const stream = new ReadableStream({
		start(controller) {
			clients.set(clientId, controller);

			// Keep-alive comment every 25s — prevents proxies and iOS from closing idle SSE streams
			const keepAlive = setInterval(() => {
				try {
					controller.enqueue(enc.encode(': ping\n\n'));
				} catch {
					clearInterval(keepAlive);
					clients.delete(clientId);
				}
			}, 25_000);

			request.signal.addEventListener('abort', () => {
				clearInterval(keepAlive);
				clients.delete(clientId);
				// Clean up any presence this client registered before they disconnected
				const prev = clearClientPresence(clientId);
				if (prev) broadcastPresence(prev.collection, prev.id, prev.count);
			});
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no', // nginx/caddy: disable response buffering for SSE
		},
	});
};

export default changesRouter;
