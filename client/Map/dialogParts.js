import { Component, Input, Select, styled, theme } from '@vanilla-bean/components';

import { AREA_UNITS } from '../geo';

const { space } = theme;

// The pieces the map's hand-built entity dialogs share

export const Caption = styled(
	Component,
	({ colors, space }) => `
		display: block;
		margin: ${space.md} 0 ${space.xs};
		font-size: 13px;
		color: ${colors.muted};
	`,
	{ tag: 'label' },
);

const Hint = styled(
	Component,
	({ colors }) => `
		font-size: 11px;
		color: ${colors.gray};
	`,
	{ tag: 'span' },
);

const Row = styled(
	Component,
	({ space }) => `
		display: flex;
		align-items: center;
		gap: ${space.sm};
	`,
);

// One field's frame around the size, its unit and the recalculate button
const AreaFrame = styled(
	Component,
	({ colors, radius, space }) => `
		display: flex;
		align-items: center;
		overflow: hidden;
		background-color: ${colors.alpha(colors.white, 0.06)};
		border: 1px solid ${colors.alpha(colors.white, 0.15)};
		border-radius: ${radius.sm};

		&:focus-within {
			border-color: ${colors.light(colors.blue)};
			box-shadow: 0 0 0 2px ${colors.alpha(colors.blue, 0.35)};
		}

		& input, & select {
			min-width: 0;
			background: transparent;
			border: none;
			outline: none;
			box-shadow: none;
			color: ${colors.white};
			font-family: inherit;
		}

		& input {
			flex: 1;
			padding: ${space.sm} ${space.md};
			font-size: 16px;
		}

		& select {
			flex-shrink: 0;
			width: 54px;
			padding: ${space.sm} ${space.xs};
			border-left: 1px solid ${colors.border};
			font-size: 13px;
			cursor: pointer;
		}

		& button {
			flex-shrink: 0;
			border-radius: 0;
			border-left: 1px solid ${colors.border};
			padding: ${space.sm} ${space.md};
			font-size: 13px;
		}
	`,
);

/**
 * A size input with its unit beside it, in one field's frame
 * @param {Component|HTMLElement} appendTo - Where it goes
 * @param {object} options - Area options
 * @param {number|string} [options.estimate] - The size shown and hinted before the user types one
 * @param {string} options.unit - The unit selected
 * @returns {{ row: Component, input: Elem, unitSelect: Elem }} The frame (for a recalculate button), the size input and the unit select
 */
export const areaField = (appendTo, { estimate, unit }) => {
	new Caption({ appendTo, textContent: 'Area' });

	const row = new AreaFrame({ appendTo });

	const input = new Input({
		appendTo: row,
		attributes: { type: 'number', step: '0.01', min: '0', placeholder: estimate ? `~${estimate}` : 'Size' },
	});

	input.elem.value = estimate || '';

	const unitSelect = new Select({ appendTo: row });

	for (const { value, label } of AREA_UNITS) {
		const opt = document.createElement('option');

		opt.value = value;
		opt.textContent = label;
		unitSelect.elem.append(opt);
	}

	unitSelect.elem.value = unit;

	return { row, input, unitSelect };
};

/**
 * A checkbox with its caption beside it
 * @param {Component|HTMLElement} appendTo - Where it goes
 * @param {object} options - Toggle options
 * @param {string} options.label - The caption
 * @param {boolean} options.checked - Whether it starts checked
 * @param {object} [options.style] - Extra inline style for the row
 * @returns {Elem} The checkbox
 */
export const checkboxRow = (appendTo, { label, checked, style }) => {
	const id = `lbl-${Math.random().toString(36).slice(2)}`;
	const row = new Row({ appendTo, style: { marginTop: space.md, ...style } });
	const checkbox = new Input({ appendTo: row, attributes: { type: 'checkbox', id } });

	checkbox.elem.checked = checked;

	new Caption({
		appendTo: row,
		textContent: label,
		attributes: { for: id },
		style: { margin: '0', cursor: 'pointer', userSelect: 'none' },
	});

	return checkbox;
};

/**
 * The emoji that marks an entity on the map, guessed from its type until the user picks one
 * @param {Component|HTMLElement} appendTo - Where it goes
 * @param {string} value - The emoji shown
 * @returns {Input} The emoji input; its dataset.manual is set once the user types in it
 */
export const emojiField = (appendTo, value) => {
	const row = new Row({ appendTo, style: { margin: `${space.sm} 0` } });

	const input = new Input({
		appendTo: row,
		type: 'text',
		value,
		attributes: { maxlength: '4', title: 'Tap to change emoji — auto-detected from type' },
		style: { width: '52px', padding: space.xs, flexShrink: '0', fontSize: '22px', textAlign: 'center' },
	});

	const hint = new Hint({ appendTo: row, textContent: 'Auto-detected · tap to change' });

	input.elem.addEventListener('input', () => {
		input.elem.dataset.manual = input.elem.value ? '1' : '';
		hint.elem.textContent = input.elem.value ? 'Custom · clear to auto-detect' : 'Auto-detected · tap to change';
	});

	return input;
};

// Where a file is dropped or tapped to browse
export const DropZone = styled(
	Component,
	({ colors, radius, space }) => `
		margin: ${space.sm} 0;
		padding: 28px 16px;
		border: 2px dashed ${colors.gray};
		border-radius: ${radius.lg};
		text-align: center;
		color: ${colors.gray};
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;

		&.drag-over {
			border-color: ${colors.light(colors.green)};
			color: ${colors.light(colors.green)};
		}

		& .drop-icon {
			margin-bottom: ${space.sm};
			font-size: 32px;
		}

		& .drop-sub {
			margin-top: ${space.xs};
			font-size: 12px;
		}
	`,
);

// The features a file holds, listed before they're imported
export const PreviewList = styled(
	Component,
	({ colors, radius, space }) => `
		max-height: 200px;
		overflow-y: auto;
		margin-bottom: ${space.md};
		border: 1px solid ${colors.border};
		border-radius: ${radius.md};
		font-size: 12px;

		& > * {
			padding: ${space.sm} ${space.md};
			border-bottom: 1px solid ${colors.border};
		}

		& > .more {
			border-bottom: none;
			font-size: 11px;
			color: ${colors.gray};
		}
	`,
);

export const Lead = styled(
	Component,
	({ colors, space }) => `
		margin: 0 0 ${space.sm};
		font-size: 13px;
		color: ${colors.gray};
	`,
	{ tag: 'p' },
);
