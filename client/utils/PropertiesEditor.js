import { Button, Elem, Input, SectionLabel, theme } from '@vanilla-bean/components';

const { space } = theme;

export const makePropertiesEditor = (container, initialProperties = {}) => {
	const root = container.elem ?? container;

	new SectionLabel({ appendTo: root, textContent: 'Properties' });

	const rowsEl = new Elem({ tag: 'div', appendTo: root });

	const rows = [];

	const addRow = (key = '', value = '') => {
		const row = new Elem({
			tag: 'div',
			style: { display: 'flex', gap: space.sm, marginBottom: space.sm },
			appendTo: rowsEl,
		});

		const keyInput = new Input({ appendTo: row, style: { flex: '1' }, placeholder: 'Key' });
		const valueInput = new Input({ appendTo: row, style: { flex: '2' }, placeholder: 'Value' });

		keyInput.elem.value = key;
		valueInput.elem.value = value;

		new Button({
			appendTo: row,
			variant: 'flat',
			icon: 'xmark',
			title: 'Remove property',
			style: { flexShrink: '0' },
			onPointerPress: () => {
				rowsEl.elem.removeChild(row.elem);
				const idx = rows.indexOf(entry);
				if (idx !== -1) rows.splice(idx, 1);
			},
		});

		const entry = { keyInput, valueInput };
		rows.push(entry);
		return entry;
	};

	for (const [k, v] of Object.entries(initialProperties)) {
		addRow(k, String(v));
	}

	new Button({
		appendTo: root,
		variant: 'flat',
		icon: 'plus',
		textContent: 'Add Property',
		style: { marginTop: space.xs },
		onPointerPress: () => addRow(),
	});

	const collect = () => {
		const result = {};
		for (const { keyInput, valueInput } of rows) {
			const k = keyInput.elem.value.trim();
			const v = valueInput.elem.value.trim();
			if (k) result[k] = v;
		}
		return result;
	};

	return { collect };
};
