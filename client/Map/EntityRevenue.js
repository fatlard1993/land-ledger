import {
	Button,
	Component,
	failureReason,
	FormDialog,
	Input,
	Notify,
	Select,
	styled,
	theme,
} from '@vanilla-bean/components';

import { formatDollar } from '../utils/format';
import { numberField, PropertiesField } from '../utils/formFields';
import { createRevenue, updateSupply, getSupplies } from '../api';
import { salePriceForSupply } from '../Supplies/SupplyDialog';
import { toDateOnly } from '../utils/dates';
import { stayOpenFor } from '../utils/stayOpenFor';
import { SubLabel } from './panelParts';

// A write that follows a save already made: if it's refused, the save stands and the person hears what didn't follow
const followUp = async (request, what) => {
	const result = await request.catch(error => ({ status: 'error', body: error }));

	if (result?.status === 'error') new Notify({ intent: 'warning', content: `${what}: ${failureReason(result)}` });

	return result;
};

const { colors, space } = theme;

const DialogNote = styled(
	Component,
	({ colors, space }) => `
		margin: 0 0 ${space.xs};
		font-size: 13px;
		color: ${colors.muted};
	`,
	{ tag: 'p' },
);

const Preview = styled(
	Component,
	({ colors, space }) => `
		min-height: 16px;
		margin-top: ${space.sm};
		font-size: 12px;
		color: ${colors.light(colors.success)};
	`,
);

// An inventory line's controls, a size down from the dialog's own fields
const LineInput = styled(Input, () => 'padding: 6px 8px; font-size: 13px; text-align: center;');
const LineSelect = styled(Select, () => 'padding: 6px 8px; font-size: 13px;');

export function openSellDialog(entityType, entity, onComplete, hide) {
	const entityLabel = entity.name || entityType;

	const dialog = new FormDialog({
		header: `Sell ${entityLabel}`,
		saveLabel: 'Record sale & remove',
		intro: new DialogNote({
			textContent: `Records a sale income entry and removes ${entityLabel} from the map. All historical records (events, leases, maintenance, etc.) are retained.`,
		}),
		data: { price: '', date: toDateOnly(), buyer: '', notes: '' },
		inputs: [
			{
				key: 'price',
				label: 'Sale Price ($)',
				placeholder: '0.00',
				...numberField({ step: '1', min: '0' }),
				validate: value => (value === '' ? 'Enter the sale price' : null),
			},
			{ key: 'date', label: 'Sale Date', type: 'date' },
			{ key: 'buyer', label: 'Buyer (optional)', placeholder: 'Buyer name or business' },
			{ key: 'notes', label: 'Notes (optional)', placeholder: 'Terms, conditions, etc.' },
		],
		onSave: async ({ price, date, buyer, notes }) => {
			const stay = stayOpenFor(
				await createRevenue({
					body: {
						entityType,
						entityId: entity.id,
						entityName: entity.name || '',
						date: date || toDateOnly(),
						amount: Number(price),
						type: 'sale',
						description: `Sale of ${entityLabel}`,
						notes: [buyer ? `Buyer: ${buyer}` : null, notes || null].filter(Boolean).join('\n'),
					},
				}),
			);

			if (stay !== undefined) return stay;

			hide();
			onComplete();
		},
	});

	dialog.form.inputElements.price.elem.focus();
}

export function openRevenueDialog(entityType, entity, existingRecord, onSave, onDelete, incomeTypes = []) {
	const rec = existingRecord || {};
	const INCOME_TYPES = incomeTypes.length ? incomeTypes : ['Rental', 'Event hosting', 'Other'];

	const dialog = new FormDialog({
		header: existingRecord ? 'Edit Income Record' : `Record Income — ${entity.name || ''}`,
		data: {
			type: rec.type || '',
			amount: rec.amount || '',
			date: rec.date || toDateOnly(),
			description: rec.description || '',
			properties: rec.properties || {},
		},
		inputs: [
			{
				key: 'type',
				label: 'Income Type',
				placeholder: 'e.g. Barn rental, Airbnb, Event hosting',
				suggestions: INCOME_TYPES,
			},
			{
				type: 'group',
				style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space.sm },
				inputs: [
					{
						key: 'amount',
						label: 'Amount ($)',
						placeholder: '0.00',
						...numberField({ step: '0.01' }),
						validate: value => (value === '' ? 'Enter an amount' : null),
					},
					{ key: 'date', label: 'Date', type: 'date' },
				],
			},
			{ key: 'description', label: 'Description', placeholder: 'What was the space used for?' },
			{ key: 'properties', InputComponent: PropertiesField },
		],
		onSave: async ({ type, amount, date, description, properties }) => {
			const stay = stayOpenFor(
				await onSave({
					entityType,
					entityId: entity.id,
					entityName: entity.name || '',
					date,
					amount: Number(amount),
					type,
					description,
					properties,
				}),
			);

			if (stay !== undefined) return stay;

			// Decrement inventory for each line item
			const lineItems = dialog._getLineItems?.() || [];
			const allSupplies = dialog._allSupplies?.() || [];

			for (const line of lineItems) {
				const supply = allSupplies.find(s => s.id === line.supplyId);

				if (supply) {
					const newStock = Math.max(0, (Number(supply.currentStock) || 0) - Number(line.qty));

					await followUp(
						updateSupply(supply.id, { body: { currentStock: newStock, _v: supply._v } }),
						`Sale recorded, but ${supply.name}'s stock wasn't updated`,
					);
				}
			}
		},
		...(existingRecord &&
			onDelete && {
				onDelete: async () => stayOpenFor(await onDelete()),
				confirmDelete: { header: 'Delete this income record?' },
			}),
	});

	const formData = dialog.form.options.data;

	// Optional: sell from operation inventory. The lines aren't the record's: they say what stock the sale used, taken
	// off once it's saved, and fill in its amount and type
	if (!existingRecord) {
		const divider = new Component({
			appendTo: dialog.body,
			style: { borderTop: `1px solid ${colors.border}`, marginTop: space.md, paddingTop: space.md },
		});

		const inventoryHeaderRow = new Component({
			appendTo: divider,
			style: {
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				gap: space.sm,
				marginBottom: space.sm,
			},
		});

		new SubLabel({
			appendTo: inventoryHeaderRow,
			style: { margin: '0' },
			textContent: 'Deduct from inventory (optional)',
		});

		const linesContainer = new Component({ appendTo: divider });

		const totalPreview = new Preview({ appendTo: divider });

		// lineItems: [{ supplyId, qty, unitPrice }]
		const lineItems = [];

		const recalculateTotal = () => {
			const total = lineItems.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);

			if (total > 0) {
				totalPreview.elem.textContent = `= ${formatDollar(total, 2)} — auto-fills Amount`;
				formData.amount = total.toFixed(2);
			} else {
				totalPreview.elem.textContent = '';
			}
		};

		let allSupplies = [];

		getSupplies()
			.then(data => {
				allSupplies = Object.values(data?.body || {})
					.filter(s => Number(s.currentStock) > 0)
					.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
			})
			.catch(() => {});

		const supplyOptions = () => [
			{ value: '', label: '— select item —' },
			...allSupplies.map(s => ({ value: s.id, label: `${s.name} (${s.currentStock} ${s.unit || 'units'})` })),
		];
		const lineSelects = new Set();

		const addLine = () => {
			const lineData = { supplyId: '', qty: '', price: '' };

			lineItems.push(lineData);

			const lineRow = new Component({
				appendTo: linesContainer,
				style: {
					display: 'grid',
					gridTemplateColumns: '2fr 70px 70px 28px',
					gap: space.xs,
					alignItems: 'center',
					marginBottom: space.xs,
				},
			});

			const select = new LineSelect({
				appendTo: lineRow,
				attributes: { 'aria-label': 'Inventory item' },
				options: supplyOptions(),
			});

			lineSelects.add(select);

			const qtyI = new LineInput({ appendTo: lineRow, attributes: { 'aria-label': 'Quantity' } });

			Object.assign(qtyI.elem, { type: 'number', step: '0.1', min: '0.01', placeholder: 'Qty' });

			const priceI = new LineInput({ appendTo: lineRow, attributes: { 'aria-label': 'Price per unit' } });

			Object.assign(priceI.elem, { type: 'number', step: '0.01', placeholder: '$/unit' });

			new Button({
				appendTo: lineRow,
				variant: 'flat',
				icon: 'xmark',
				title: 'Remove item',
				style: { width: '28px', color: colors.gray },
				onPointerPress: () => {
					const idx = lineItems.indexOf(lineData);

					if (idx !== -1) lineItems.splice(idx, 1);
					lineSelects.delete(select);
					lineRow.elem.remove();
					recalculateTotal();
				},
			});

			select.elem.addEventListener('change', () => {
				lineData.supplyId = select.options.value;

				const supply = allSupplies.find(s => s.id === select.options.value);
				const salePrice = salePriceForSupply(supply);

				if (salePrice != null) priceI.options.value = salePrice.toFixed(2);
				lineData.price = priceI.options.value;

				if (!formData.type) formData.type = 'Inventory sale';
				recalculateTotal();
			});

			qtyI.elem.addEventListener('input', () => {
				lineData.qty = qtyI.options.value;
				recalculateTotal();
			});
			priceI.elem.addEventListener('input', () => {
				lineData.price = priceI.options.value;
				recalculateTotal();
			});
		};

		new Button({
			appendTo: inventoryHeaderRow,
			variant: 'flat',
			size: 'small',
			icon: 'plus',
			textContent: 'Add item',
			style: { flexShrink: '0' },
			onPointerPress: () => {
				// Rebuild options in case supplies loaded after initial click
				for (const select of lineSelects) select.options.options = supplyOptions();
				addLine();
			},
		});

		// Expose line items for the save handler
		dialog._getLineItems = () => lineItems.filter(l => l.supplyId && Number(l.qty) > 0);
		dialog._allSupplies = () => allSupplies;
	}
}
