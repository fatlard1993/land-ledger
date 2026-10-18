import { Notify } from '@vanilla-bean/components';

// A FormDialog stays open when its onSave or onDelete returns false. The request library resolves a failed request instead of
// throwing, so a caller hands its request's result back and a failure becomes that false, with the reason shown. A
// write queued while offline answers 202, which counts as done.
export const keepOpenIfFailed = (result, action = 'Save') => {
	if (result?.status === 'error') {
		const reason =
			typeof result.body === 'string' && result.body.length < 120
				? result.body
				: `status ${result.response?.status ?? 'unknown'}`;

		new Notify({ type: 'error', textContent: `${action} failed: ${reason}`, timeout: 6000 });

		return false;
	}

	// A conflict the user backed out of: their edits stay in the dialog
	if (result?.success === false) return false;

	return undefined;
};
