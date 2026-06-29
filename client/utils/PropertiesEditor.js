import { Elem, Component, styled } from '@vanilla-bean/components';
import { FormInput, SectionHeader } from '../Layout';

const DeleteBtn = styled(
	Component,
	() => `
    flex-shrink: 0;
    background: none;
    border: none;
    color: rgba(255,255,255,0.3);
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    &:hover { color: #e05252; }
`,
);

const AddPropertyBtn = styled(
	Component,
	() => `
    background: none;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 4px;
    color: rgba(255,255,255,0.5);
    font-size: 13px;
    padding: 5px 10px;
    cursor: pointer;
    font-family: inherit;
    margin-top: 2px;
    &:hover { color: #fff; border-color: rgba(255,255,255,0.35); }
`,
);

export const makePropertiesEditor = (container, initialProperties = {}) => {
	const root = container.elem ?? container;

	new SectionHeader({ appendTo: root, textContent: 'Properties' });

	const rowsEl = new Elem({ tag: 'div', appendTo: root });

	const rows = [];

	const addRow = (key = '', value = '') => {
		const row = new Elem({ tag: 'div', style: { display: 'flex', gap: '6px', marginBottom: '5px' }, appendTo: rowsEl });

		const keyInput = new FormInput({ appendTo: row, style: { flex: '1' }, placeholder: 'Key' });
		const valueInput = new FormInput({ appendTo: row, style: { flex: '2' }, placeholder: 'Value' });

		keyInput.elem.value = key;
		valueInput.elem.value = value;

		new DeleteBtn({
			tag: 'button',
			textContent: '×',
			appendTo: row,
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

	new AddPropertyBtn({
		tag: 'button',
		textContent: '+ Add Property',
		appendTo: root,
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
