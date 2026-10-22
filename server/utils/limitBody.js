export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB — GeoJSON / CSV uploads
export const MAX_JSON_BYTES = 1 * 1024 * 1024; //  1 MB — regular API JSON bodies
export const MAX_IMPORT_ROWS = 10_000; // row cap for tabular apply

// Async guard that catches both declared (Content-Length) and chunked bodies.
// Clones the request to read size without consuming the original — handlers
// can still call request.json() after this returns null.
export async function enforceJsonBodyLimit(request, maxBytes = MAX_JSON_BYTES) {
	const length = Number(request.headers.get('content-length') ?? -1);

	if (length > maxBytes) return new Response('Payload Too Large', { status: 413 });
	if (length >= 0) return null; // Content-Length present and within limit

	// No Content-Length (chunked transfer) — measure via a clone
	try {
		const text = await request.clone().text();
		if (Buffer.byteLength(text, 'utf8') > maxBytes) {
			return new Response('Payload Too Large', { status: 413 });
		}
	} catch {}

	return null;
}
