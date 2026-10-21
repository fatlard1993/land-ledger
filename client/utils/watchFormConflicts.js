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

import { Button, Component, styled } from '@vanilla-bean/components';

import { formatVal } from './format.js';

const Banner = styled(
	Component,
	({ colors, radius }) => `
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 10px;
		padding: 8px 10px;
		border: 1px solid ${colors.alpha(colors.warning, 0.35)};
		border-radius: ${radius.sm};
		background: ${colors.alpha(colors.warning, 0.1)};
		font-size: 12px;
		color: ${colors.light(colors.warning)};
	`,
);

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
		const banner = new Banner();

		new Component({
			tag: 'span',
			appendTo: banner,
			textContent: `${changed.size} field${changed.size !== 1 ? 's' : ''} changed on another device`,
		});

		const buttons = new Component({ appendTo: banner, style: { display: 'flex', gap: '6px', flexShrink: '0' } });

		new Button({ appendTo: buttons, variant: 'chip', textContent: 'Accept all', onPointerPress: acceptAll });
		new Button({ appendTo: buttons, variant: 'flat', textContent: 'Dismiss', onPointerPress: clearAll });

		_banner = banner.elem;

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
