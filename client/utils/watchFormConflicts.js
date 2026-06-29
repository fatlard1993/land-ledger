// Utility: watch a live server record for changes while a VBC Form is open.
//
// When a livesync:change event fires for the watched entity, fetches the current
// server state and diffs it against the form's current field values. For each
// field that diverged, appends a "Server has: X" validator to input.options.validations
// and calls validate() — making VBC render the field-level error UI as normal.
// A banner above the form offers "Accept all" (copies server values into the form
// and clears the injected validators) or "Dismiss" (clears validators, keeps user values).
//
// Returns a cleanup function — pass it to form.addCleanup() or call on dialog close.

import { formatVal } from './format.js';

export function watchFormConflicts(form, collection, id) {
	if (!form || !collection || !id) return () => {};

	// Track injected state so we can cleanly remove it
	const _active = new Map(); // key → serverValue
	const _origV = new Map(); // key → original input.options.validations

	let _banner = null;
	let _serverRecord = null;

	const clearAll = () => {
		for (const [key] of _active) {
			const input = form.inputElements[key];
			if (!input) continue;
			input.options.validations = _origV.get(key);
			input.validate();
		}
		_active.clear();
		_origV.clear();
		_banner?.remove();
		_banner = null;
		_serverRecord = null;
	};

	const acceptAll = () => {
		for (const [key, serverValue] of _active) {
			// Writing to the Context propagates to the subscribed input's DOM via the reactive Subscriber.
			// Also sync options.value directly so hasErrors() reads the correct value after acceptance.
			form.options.data[key] = serverValue;
			const input = form.inputElements[key];
			if (input) input.options.value = serverValue;
		}
		clearAll();
	};

	const applyConflicts = async () => {
		try {
			const res = await fetch(`/${collection}/${id}`);
			if (!res.ok) return;
			_serverRecord = await res.json();
		} catch {
			return;
		}

		// Wipe any previous conflict state before re-diffing
		clearAll();

		const changed = new Map();

		for (const [key] of Object.entries(form.inputElements)) {
			const serverValue = _serverRecord[key];
			if (serverValue === undefined) continue;
			const formValue = form.options.data[key];
			if (JSON.stringify(formValue) !== JSON.stringify(serverValue)) {
				changed.set(key, serverValue);
			}
		}

		if (!changed.size) return;

		// Append conflict validators to each affected field
		for (const [key, serverValue] of changed) {
			const input = form.inputElements[key];
			if (!input) continue;
			_active.set(key, serverValue);
			_origV.set(key, input.options.validations);
			input.options.validations = [
				...(input.options.validations || []),
				[() => false, `Server has: ${formatVal(serverValue)}`],
			];
			input.validate();
		}

		// Build banner
		_banner = document.createElement('div');
		Object.assign(_banner.style, {
			background: 'rgba(232,196,42,0.1)',
			border: '1px solid rgba(232,196,42,0.35)',
			borderRadius: '4px',
			padding: '8px 10px',
			fontSize: '12px',
			color: '#e8c42a',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'space-between',
			gap: '8px',
			marginBottom: '10px',
		});

		const msg = document.createElement('span');
		msg.textContent = `${changed.size} field${changed.size !== 1 ? 's' : ''} changed on another device`;
		_banner.append(msg);

		const buttons = document.createElement('div');
		Object.assign(buttons.style, { display: 'flex', gap: '6px', flexShrink: '0' });

		const acceptBtn = document.createElement('button');
		acceptBtn.textContent = 'Accept all';
		Object.assign(acceptBtn.style, {
			background: 'rgba(232,196,42,0.2)',
			border: '1px solid rgba(232,196,42,0.5)',
			color: '#e8c42a',
			fontSize: '11px',
			padding: '2px 8px',
			borderRadius: '3px',
			cursor: 'pointer',
		});
		acceptBtn.addEventListener('click', acceptAll);

		const dismissBtn = document.createElement('button');
		dismissBtn.textContent = 'Dismiss';
		Object.assign(dismissBtn.style, {
			background: 'none',
			border: '1px solid rgba(255,255,255,0.15)',
			color: 'rgba(255,255,255,0.5)',
			fontSize: '11px',
			padding: '2px 8px',
			borderRadius: '3px',
			cursor: 'pointer',
		});
		dismissBtn.addEventListener('click', clearAll);

		buttons.append(acceptBtn, dismissBtn);
		_banner.append(buttons);

		// Insert directly before the form element
		form.elem.insertAdjacentElement('beforebegin', _banner);
	};

	const handler = e => {
		if (e.detail.collection !== collection || e.detail.id !== id) return;
		applyConflicts();
	};

	document.addEventListener('livesync:change', handler);

	return () => {
		document.removeEventListener('livesync:change', handler);
		clearAll();
	};
}
