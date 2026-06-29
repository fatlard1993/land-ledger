import { PATCH } from '@vanilla-bean/hypertether';

// Wraps PATCH with optimistic-lock conflict resolution.
// On 409 with { _conflict, current }: shows the ConflictDialog and retries with the
// resolved body. Returns the final RequestResult so callers are transparent to conflicts.
export const versionedUpdate = (path, options) => attempt(path, options, 0);

async function attempt(path, options, retries) {
	const result = await PATCH(path, options);

	if (result?.response?.status !== 409 || !result?.body?._conflict) return result;
	if (retries >= 3) return result;

	const patchBody = options.body || {};
	const current = result.body.current;

	// Find which fields in our PATCH differ from what the server currently has
	const conflictingFields = Object.keys(patchBody)
		.filter(k => k !== '_v' && JSON.stringify(patchBody[k]) !== JSON.stringify(current[k]))
		.map(k => ({ key: k, ourValue: patchBody[k], serverValue: current[k] }));

	if (!conflictingFields.length) {
		// Version bump but no actual content difference — retry transparently with current _v
		return attempt(path, { ...options, body: { ...patchBody, _v: current._v } }, retries + 1);
	}

	const { showConflictDialog } = await import('../ConflictDialog.js');
	const resolved = await showConflictDialog([
		{
			entry: { timestamp: Date.now(), url: path, method: 'PATCH', body: JSON.stringify(patchBody), snapshot: null },
			current,
			conflictingFields,
		},
	]);

	// User cancelled — return a no-op so callers don't update local state
	if (!resolved) return { ...result, body: null, success: false };

	// User chose all server values — return current so callers sync to server state
	if (resolved[0]?.body === null) return { ...result, body: current, success: true };

	const resolvedBody = { ...JSON.parse(resolved[0].body), _v: current._v };
	return attempt(path, { ...options, body: resolvedBody }, retries + 1);
}
