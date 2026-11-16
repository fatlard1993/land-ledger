import { Button, Component, Input, styled, theme } from '@vanilla-bean/components';

const { space } = theme;

// Form fields of the app's own, for a Form's or FormDialog's `inputs`: each takes `value` and announces `change` with
// `event.value`, as Form expects of an InputComponent

// A number field's declaration options
export const numberField = (attributes = {}) => ({ type: 'number', attributes });

// A checkbox's declaration, its label after it on the same line (form.checkbox-label-after)
export const checkboxField = (key, label, options = {}) => ({
	key,
	type: 'checkbox',
	label: { label, variant: 'inline-after' },
	...options,
});

// The key/value pairs a record keeps beyond its own fields; untrimmed or keyless pairs aren't kept
export const collectProperties = pairs => {
	const result = {};

	for (const [key, value] of pairs) {
		const k = String(key ?? '').trim();

		if (k) result[k] = String(value ?? '').trim();
	}

	return result;
};

const sameProperties = (a = {}, b = {}) => JSON.stringify(a) === JSON.stringify(b);

const PropertyRow = styled(
	Component,
	({ space }) => `
		display: flex;
		gap: ${space.sm};
		margin-bottom: ${space.sm};

		& > .key {
			flex: 1;
		}

		& > .value {
			flex: 2;
		}

		& > button {
			flex-shrink: 0;
		}
	`,
);

/**
 * A record's free properties: rows of a name and a value, added and removed as the user likes. Its value is the pairs
 * as an object, trimmed, without the rows that have no name.
 * @param {object} [options] - Component options
 * @param {object} [options.value] - The properties shown
 */
export class PropertiesField extends Component {
	static schema = {
		value: {
			get default() {
				return {};
			},
			set(value) {
				// A value this field announced itself is already what its rows hold
				if (this._rows && !sameProperties(value, this._collect())) this._showRows(value);
			},
		},
	};

	build() {
		// A group, named by the Form's label
		this.elem.setAttribute('role', 'group');

		this._rowsElem = new Component({ appendTo: this });
		this._rows = [];
		this._showRows(this.options.value);

		new Button({
			appendTo: this,
			variant: 'flat',
			icon: 'plus',
			textContent: 'Add property',
			style: { marginTop: space.xs },
			onPointerPress: () => this._addRow().keyInput.elem.focus(),
		});

		// Held as the rows give it, so a value saved as it was loaded is the same either way
		this.options.value = this._collect();
	}

	_collect() {
		return collectProperties(
			this._rows.map(({ keyInput, valueInput }) => [keyInput.options.value, valueInput.options.value]),
		);
	}

	_showRows(value) {
		this._rowsElem.empty();
		this._rows = [];

		for (const [key, val] of Object.entries(value || {})) this._addRow(key, String(val ?? ''));
	}

	_announce() {
		this.options.value = this._collect();
		this.emit('change', { value: this.options.value });
	}

	_addRow(key = '', value = '') {
		const row = new PropertyRow({ appendTo: this._rowsElem });
		const field = (className, placeholder, label, initial) => {
			const input = new Input({
				appendTo: row,
				addClass: className,
				placeholder,
				value: initial,
				attributes: { 'aria-label': label },
			});

			// The row's own change isn't the field's: it's announced as the whole set of properties
			input.elem.addEventListener('change', event => {
				event.stopPropagation();
				this._announce();
			});
			input.elem.addEventListener('input', () => this._announce());

			return input;
		};

		const entry = {
			keyInput: field('key', 'Key', 'Property name', key),
			valueInput: field('value', 'Value', 'Property value', value),
		};

		new Button({
			appendTo: row,
			variant: 'flat',
			icon: 'xmark',
			title: 'Remove property',
			onPointerPress: () => {
				row.destroy();
				this._rows.splice(this._rows.indexOf(entry), 1);
				this._announce();
			},
		});

		this._rows.push(entry);

		return entry;
	}
}

export const EMOJI_AUTO_HINT = 'Emoji: auto-detected · tap to change';
export const EMOJI_CUSTOM_HINT = 'Emoji: custom · clear to auto-detect';

/**
 * The emoji that marks a record, guessed from what it is until the user types one. The field's label is its hint, after
 * it, saying which it is. Set `auto` to the emoji guessed: it's shown unless the user has typed their own.
 * @param {object} [options] - Input options
 * @param {string} [options.auto] - The emoji guessed
 */
export class EmojiInput extends Input {
	static schema = {
		auto: {
			set(value) {
				if (!this.manual) this._showAuto(value);
			},
		},
	};

	static prepareOptions(options) {
		return {
			type: 'text',
			title: 'Tap to change emoji — auto-detected',
			...super.prepareOptions(options),
			attributes: { maxlength: '4', ...options.attributes },
			style: {
				flex: `0 0 52px`,
				width: '52px',
				padding: space.xs,
				fontSize: '22px',
				textAlign: 'center',
				...options.style,
			},
		};
	}

	build() {
		super.build();

		this.elem.addEventListener('input', () => {
			// Cleared, the field goes back to guessing
			this.manual = !!this.options.value;
			this._showHint();
		});
	}

	// Shown as the field's value, so the form holds it as it would one typed
	_showAuto(value) {
		if (this.options.value === value) return;

		this.options.value = value;
		this.emit('change', { value });
		this._showHint();
	}

	_showHint() {
		const label = this.elem.parentElement?.querySelector(':scope > label');

		if (label) label.textContent = this.manual ? EMOJI_CUSTOM_HINT : EMOJI_AUTO_HINT;
	}
}

// An EmojiInput's declaration in a Form's inputs, labelled by its hint after it
export const emojiInput = (key = 'emoji', options = {}) => ({
	key,
	InputComponent: EmojiInput,
	label: { label: EMOJI_AUTO_HINT, variant: 'inline-after' },
	...options,
});

const ChoiceRow = styled(
	Component,
	({ space }) => `
		display: flex;
		gap: ${space.sm};

		& > button {
			flex: 1;
		}
	`,
);

/**
 * One of a few choices, all shown as a row of pressed chips (form.single-choice allows it for two to five). Its value is
 * the chosen one's `value`.
 * @param {object} [options] - Component options
 * @param {Array<{ value: string, label: string, icon?: string }>} options.choices - The choices
 * @param {string} [options.value] - The one chosen
 */
export class ChoiceChips extends ChoiceRow {
	static schema = {
		choices: {},
		value: {
			set(value) {
				for (const [button, choice] of this._buttons ?? []) button.options.pressed = choice === value;
			},
		},
	};

	build() {
		// A group, named by the Form's label
		this.elem.setAttribute('role', 'group');

		this._buttons = (this.options.choices ?? []).map(({ value, label, icon }) => [
			new Button({
				appendTo: this,
				variant: 'chip',
				icon,
				textContent: label,
				pressed: this.options.value === value,
				onPointerPress: () => {
					if (this.options.value === value) return;

					this.options.value = value;
					this.emit('change', { value });
				},
			}),
			value,
		]);
	}
}
