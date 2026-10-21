import { Notify } from '@vanilla-bean/components';
import { failureReason } from '@vanilla-bean/hypertether';

// A FormDialog stays open when its onSave or onDelete returns false. The request library resolves a failed request instead of
// throwing, so a caller hands its request's result back and a failure becomes that false, with the reason shown. A
// write queued while offline answers 202, which counts as done.
export const keepOpenIfFailed = (result, action = 'Save') => {
	if (result?.status === 'error') {
		const reason = failureReason(result);
		// A long body is a page from something in between (a proxy), not a reason
		const shown = reason.length < 120 ? reason : `HTTP ${result.response?.status}`;

		new Notify({ type: 'error', textContent: `${action} failed: ${shown}`, timeout: 6000 });

		return false;
	}

	// A conflict the user backed out of: their edits stay in the dialog
	if (result?.success === false) return false;

	return undefined;
};
