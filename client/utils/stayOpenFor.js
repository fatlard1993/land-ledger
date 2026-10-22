// What a FormDialog's onSave or onDelete hands back to stay open after a request: the failed result itself, whose reason
// FormDialog shows, or false for a conflict the user backed out of, whose edits stay in the dialog. Undefined carries on;
// a write queued while offline answers 202, which counts as done.
export const stayOpenFor = result => {
	if (result?.status === 'error') return result;
	if (result?.success === false) return false;

	return undefined;
};
