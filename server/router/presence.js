import { requestMatch } from '@vanilla-bean/components/app';

// clientId → { collection, id, lastSeen }
const watching = new Map();

// `${collection}:${id}` → Set<clientId>
const entityWatchers = new Map();

// Evict clients that posted presence but never connected the SSE stream (or whose
// stream closed without triggering a cleanup). Runs every 5 minutes.
const PRESENCE_TTL_MS = 10 * 60 * 1000;
setInterval(
	() => {
		const now = Date.now();
		for (const [clientId, entry] of watching) {
			if (now - entry.lastSeen > PRESENCE_TTL_MS) clearClientPresence(clientId);
		}
	},
	5 * 60 * 1000,
).unref();

const eKey = (collection, id) => `${collection}:${id}`;

// Called by changes.js on SSE disconnect to clean up orphaned presence entries.
// Returns { collection, id, count } so the caller can broadcast the updated count,
// or null if the client had no registered presence.
export const clearClientPresence = clientId => {
	const current = watching.get(clientId);
	if (!current) return null;

	watching.delete(clientId);

	const key = eKey(current.collection, current.id);
	const set = entityWatchers.get(key);

	if (set) {
		set.delete(clientId);
		if (set.size === 0) entityWatchers.delete(key);
	}

	return { collection: current.collection, id: current.id, count: set?.size ?? 0 };
};

const presenceRouter = async (request, broadcast) => {
	if (!requestMatch('POST', '/presence', request)) return null;

	const clientId = request.headers.get('x-client-id');
	if (!clientId) return new Response(null, { status: 400 });

	let collection, id, action;
	try {
		({ collection, id, action } = await request.json());
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}

	if (action === 'open') {
		// Deregister any entity this client previously had open
		const prev = clearClientPresence(clientId);
		if (prev) broadcast(prev.collection, prev.id, prev.count);

		watching.set(clientId, { collection, id, lastSeen: Date.now() });
		const key = eKey(collection, id);
		if (!entityWatchers.has(key)) entityWatchers.set(key, new Set());
		entityWatchers.get(key).add(clientId);
		broadcast(collection, id, entityWatchers.get(key).size);
	} else if (action === 'close') {
		const prev = clearClientPresence(clientId);
		if (prev) broadcast(prev.collection, prev.id, prev.count);
	}

	return new Response(null, { status: 204 });
};

export default presenceRouter;
