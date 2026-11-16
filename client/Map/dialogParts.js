import { Button, Component, Input, Select, styled } from '@vanilla-bean/components';

import { AREA_UNITS, convertArea } from '../geo';

// The pieces the map's entity dialogs share

// One field's frame around the size, its unit and the recalculate button
const AreaFrame = styled(
	Component,
	({ colors, focusRing, radius, space }) => `
		display: flex;
		align-items: center;
		overflow: hidden;
		background-color: ${colors.alpha(colors.white, 0.06)};
		border: 1px solid ${colors.border};
		border-radius: ${radius.sm};

		/* The one focus ring, round the whole field */
		&:has(:focus-visible) {
			${focusRing()}
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
 * An area: its size with the unit beside it, in one field's frame, and a button that measures it from the boundary
 * when there is one. Its value is `{ size, unit }`; the size is a number once typed. The Form's label names the size.
 * @param {object} [options] - Component options
 * @param {{ size: number|string, unit: string }} [options.value] - The size shown, and its unit
 * @param {number} [options.sqm] - The boundary's area in square metres, measured again in the unit picked
 * @param {boolean} [options.measurable] - Whether to offer the measure button
 */
export class AreaField extends AreaFrame {
	static schema = {
		value: {
			get default() {
				return { size: '', unit: 'ac' };
			},
			set(value) {
				if (!this._size) return;

				this._size.options.value = value?.size ?? '';
				this._unit.options.value = value?.unit;
			},
		},
		sqm: {},
		measurable: {},
	};

	build() {
		const { size = '', unit } = this.options.value ?? {};

		// The field's own change isn't the area's: it's announced as the size and unit together
		const owned = part => {
			part.elem.addEventListener('change', event => {
				event.stopPropagation();
				this._announce();
			});
			part.elem.addEventListener('input', () => this._announce());

			return part;
		};

		this._size = owned(
			new Input({
				appendTo: this,
				value: size,
				attributes: { type: 'number', step: '0.01', min: '0', placeholder: size ? `~${size}` : 'Size', title: 'Area' },
			}),
		);
		this._unit = owned(
			new Select({ appendTo: this, attributes: { 'aria-label': 'Area unit' }, options: AREA_UNITS, value: unit }),
		);

		if (this.options.measurable) {
			new Button({
				appendTo: this,
				variant: 'flat',
				icon: 'rotate-left',
				title: 'Calculate from boundary',
				attributes: { type: 'button' },
				onPointerPress: () => {
					const { sqm } = this.options;

					if (!sqm) return;

					const meta = AREA_UNITS.find(u => u.value === this._unit.options.value);

					this._size.options.value = convertArea(sqm, this._unit.options.value).toFixed(meta?.decimals ?? 1);
					this._announce();
				},
			});
		}
	}

	// The size's own field, which the area's label names
	get labelTarget() {
		return this._size;
	}

	_announce() {
		this.options.value = { size: this._size.options.value, unit: this._unit.options.value };
		this.emit('change', { value: this.options.value });
	}
}

// Where a file is dropped or tapped to browse
export const DropZone = styled(
	Component,
	({ colors, radius, space }) => `
		margin: ${space.sm} 0;
		padding: 28px 16px;
		border: 2px dashed ${colors.gray};
		border-radius: ${radius.lg};
		text-align: center;
		color: ${colors.muted};
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
			color: ${colors.muted};
		}
	`,
);

export const Lead = styled(
	Component,
	({ colors, space }) => `
		margin: 0 0 ${space.sm};
		font-size: 13px;
		color: ${colors.muted};
	`,
	{ tag: 'p' },
);
