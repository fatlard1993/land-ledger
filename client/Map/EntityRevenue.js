import { Elem, Dialog, Button } from '@vanilla-bean/components';

import { formatDollar } from '../utils/format';
import { makePropertiesEditor } from '../utils/PropertiesEditor';
import { createRevenue, updateSupply, getSupplies } from '../api';
import { salePriceForSupply } from '../Supplies/SupplyDialog';
import { FormLabel, FormInput } from '../Layout';

export function openSellDialog(entityType, entity, onComplete, hide) {
	const entityLabel = entity.name || entityType;

	const dialog = new Dialog({
		size: 'large',
		header: `Sell ${entityLabel}`,
		buttons: ['Record Sale & Remove', 'Cancel'],
		onButtonPress: async ({ button }) => {
			if (button === 'Record Sale & Remove') {
				if (!priceEl.elem.value) {
					priceEl.elem.style.border = '1px solid #e05252';
					return;
				}

				await createRevenue({
					body: {
						entityType,
						entityId: entity.id,
						entityName: entity.name || '',
						date: dateEl.elem.value || new Date().toISOString().slice(0, 10),
						amount: Number(priceEl.elem.value),
						type: 'sale',
						description: `Sale of ${entityLabel}`,
						notes: [buyerEl.elem.value ? `Buyer: ${buyerEl.elem.value}` : null, notesEl.elem.value || null]
							.filter(Boolean)
							.join('\n'),
					},
				});

				dialog.close();
				hide();
				onComplete();
			} else {
				dialog.close();
			}
		},
	});

	new Elem({
		tag: 'p',
		appendTo: dialog.body,
		style: { fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: '0 0 4px' },
		textContent: `Records a sale income entry and removes ${entityLabel} from the map. All historical records (events, leases, maintenance, etc.) are retained.`,
	});

	new FormLabel({ appendTo: dialog.body, textContent: 'Sale Price ($)' });
	const priceEl = new FormInput({ appendTo: dialog.body, type: 'number', step: '1', placeholder: '0.00', min: '0' });

	new FormLabel({ appendTo: dialog.body, textContent: 'Sale Date' });
	const dateEl = new FormInput({ appendTo: dialog.body, type: 'date' });
	dateEl.elem.value = new Date().toISOString().slice(0, 10);

	new FormLabel({ appendTo: dialog.body, textContent: 'Buyer (optional)' });
	const buyerEl = new FormInput({ appendTo: dialog.body, placeholder: 'Buyer name or business' });

	new FormLabel({ appendTo: dialog.body, textContent: 'Notes (optional)' });
	const notesEl = new FormInput({ appendTo: dialog.body, placeholder: 'Terms, conditions, etc.' });

	priceEl.elem.focus();
}

export function openRevenueDialog(entityType, entity, existingRecord, onSave, onDelete, incomeTypes = []) {
	const rec = existingRecord || {};
	const INCOME_TYPES = incomeTypes.length ? incomeTypes : ['Rental', 'Event hosting', 'Other'];

	const dialog = new Dialog({
		size: 'large',
		header: existingRecord ? 'Edit Income Record' : `Record Income — ${entity.name || ''}`,
		buttons: existingRecord ? ['Save', 'Delete', 'Cancel'] : ['Save', 'Cancel'],
		onButtonPress: async ({ button }) => {
			if (button === 'Save' && amountEl.elem.value) {
				await onSave({
					entityType,
					entityId: entity.id,
					entityName: entity.name || '',
					date: dateEl.elem.value,
					amount: Number(amountEl.elem.value),
					type: typeEl.elem.value,
					description: descEl.elem.value,
					properties: collectProps(),
				});

				// Decrement inventory for each line item
				const lineItems = dialog._getLineItems?.() || [];
				const allSupplies = dialog._allSupplies?.() || [];

				for (const line of lineItems) {
					const supply = allSupplies.find(s => s.id === line.supplyId);

					if (supply) {
						const newStock = Math.max(0, (Number(supply.currentStock) || 0) - Number(line.qty));

						await updateSupply(supply.id, { body: { currentStock: newStock, _v: supply._v } }).catch(() => {});
					}
				}
			} else if (button === 'Delete') {
				await onDelete?.();
			}

			dialog.close();
		},
	});

	// Type
	new FormLabel({ appendTo: dialog.body, textContent: 'Income Type' });
	const typeEl = new FormInput({
		appendTo: dialog.body,
		placeholder: 'e.g. Barn rental, Airbnb, Event hosting',
		suggestions: INCOME_TYPES,
		value: rec.type || '',
	});

	// Amount + Date
	const row = new Elem({
		tag: 'div',
		appendTo: dialog.body,
		style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
	});

	new FormLabel({ appendTo: row, textContent: 'Amount ($)' });
	const amountEl = new FormInput({ appendTo: row, type: 'number', step: '0.01', placeholder: '0.00' });
	amountEl.elem.value = rec.amount || '';

	new FormLabel({ appendTo: row, textContent: 'Date' });
	const dateEl = new FormInput({ appendTo: row, type: 'date' });
	dateEl.elem.value = rec.date || new Date().toISOString().slice(0, 10);

	new FormLabel({ appendTo: dialog.body, textContent: 'Description' });
	const descEl = new FormInput({ appendTo: dialog.body, placeholder: 'What was the space used for?' });
	descEl.elem.value = rec.description || '';

	const { collect: collectProps } = makePropertiesEditor(dialog.body, rec.properties || {});

	// Optional: sell from operation inventory
	if (!existingRecord) {
		const divider = new Elem({
			tag: 'div',
			appendTo: dialog.body,
			style: { borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '14px', paddingTop: '12px' },
		});

		const inventoryHeaderRow = new Elem({
			tag: 'div',
			appendTo: divider,
			style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
		});

		new Elem({
			tag: 'div',
			appendTo: inventoryHeaderRow,
			style: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.06em', color: 'rgba(255,255,255,0.3)' },
			textContent: '📦 Deduct from inventory (optional)',
		});

		const linesContainer = new Elem({ tag: 'div', appendTo: divider });

		const totalPreview = new Elem({
			tag: 'div',
			appendTo: divider,
			style: { fontSize: '12px', color: '#4caf50', marginTop: '6px', minHeight: '16px' },
		});

		const INP_S = {
			width: '100%',
			boxSizing: 'border-box',
			background: 'rgba(255,255,255,0.07)',
			border: '1px solid rgba(255,255,255,0.12)',
			borderRadius: '4px',
			color: '#fff',
			fontSize: '13px',
			padding: '6px 8px',
			fontFamily: 'inherit',
		};

		// lineItems: [{ supplyId, qty, unitPrice }]
		const lineItems = [];

		const recalculateTotal = () => {
			const total = lineItems.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);

			if (total > 0) {
				totalPreview.elem.textContent = `= ${formatDollar(total, 2)} — auto-fills Amount`;
				amountEl.elem.value = total.toFixed(2);
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

		const buildSupplyOptions = (select, currentVal) => {
			select.innerHTML = '';
			const none = document.createElement('option');

			none.value = '';
			none.textContent = '— select item —';
			select.append(none);
			for (const s of allSupplies) {
				const o = document.createElement('option');

				o.value = s.id;
				o.textContent = `${s.name} (${s.currentStock} ${s.unit || 'units'})`;
				o.dataset.costPerUnit = s.costPerUnit || '';
				o.dataset.stock = s.currentStock || '0';
				if (s.id === currentVal) o.selected = true;
				select.append(o);
			}
		};

		const addLine = () => {
			const lineData = { supplyId: '', qty: '', price: '' };

			lineItems.push(lineData);

			const lineRow = new Elem({
				tag: 'div',
				appendTo: linesContainer,
				style: {
					display: 'grid',
					gridTemplateColumns: '2fr 70px 70px 28px',
					gap: '4px',
					alignItems: 'center',
					marginBottom: '4px',
				},
			});

			const select = new Elem({
				tag: 'select',
				appendTo: lineRow,
				style: { ...INP_S, cursor: 'pointer', appearance: 'auto', webkitAppearance: 'auto' },
			});

			buildSupplyOptions(select.elem, '');

			const qtyI = new Elem({ tag: 'input', appendTo: lineRow, style: { ...INP_S, textAlign: 'center' } });

			Object.assign(qtyI.elem, { type: 'number', step: '0.1', min: '0.01', placeholder: 'Qty' });

			const priceI = new Elem({ tag: 'input', appendTo: lineRow, style: { ...INP_S, textAlign: 'center' } });

			Object.assign(priceI.elem, { type: 'number', step: '0.01', placeholder: '$/unit' });

			new Button({
				appendTo: lineRow,
				textContent: '✕',
				style: {
					background: 'none',
					border: 'none',
					color: 'rgba(255,255,255,0.3)',
					cursor: 'pointer',
					fontSize: '13px',
					padding: '2px 4px',
				},
				onPointerPress: () => {
					const idx = lineItems.indexOf(lineData);

					if (idx !== -1) lineItems.splice(idx, 1);
					lineRow.elem.remove();
					recalculateTotal();
				},
			});

			select.elem.addEventListener('change', () => {
				lineData.supplyId = select.elem.value;

				const supply = allSupplies.find(s => s.id === select.elem.value);
				const salePrice = salePriceForSupply(supply);

				if (salePrice != null) priceI.elem.value = salePrice.toFixed(2);
				lineData.price = priceI.elem.value;

				if (!typeEl.elem.value || typeEl.elem.value === '') typeEl.elem.value = 'Inventory sale';
				recalculateTotal();
			});

			qtyI.elem.addEventListener('input', () => {
				lineData.qty = qtyI.elem.value;
				recalculateTotal();
			});
			priceI.elem.addEventListener('input', () => {
				lineData.price = priceI.elem.value;
				recalculateTotal();
			});
		};

		new Button({
			appendTo: inventoryHeaderRow,
			textContent: '+ Add item',
			style: {
				fontSize: '11px',
				padding: '2px 8px',
				borderRadius: '4px',
				cursor: 'pointer',
				border: '1px solid rgba(255,255,255,0.15)',
				background: 'rgba(255,255,255,0.05)',
				color: 'rgba(255,255,255,0.5)',
				fontFamily: 'inherit',
			},
			onPointerPress: () => {
				// Rebuild options in case supplies loaded after initial click
				linesContainer.elem.querySelectorAll('select').forEach(s => buildSupplyOptions(s, s.value));
				addLine();
			},
		});

		// Expose line items for the save handler
		dialog._getLineItems = () => lineItems.filter(l => l.supplyId && Number(l.qty) > 0);
		dialog._allSupplies = () => allSupplies;
	}
}

export function openInventorySaleDialog(supply, building, refresh) {
	const onHand = Number(supply.currentStock) || 0;
	const costPerUnit = Number(supply.costPerUnit) || 0;

	const dialog = new Dialog({
		size: 'large',
		header: `🛒 Sell — ${supply.name}`,
		buttons: ['Record Sale', 'Cancel'],
		onButtonPress: async ({ button }) => {
			if (button === 'Record Sale') {
				const qty = Number(qtyEl.elem.value);
				const price = Number(priceEl.elem.value);

				if (!qty || qty <= 0) return;

				const newStock = Math.max(0, onHand - qty);
				const revenue = qty * price;

				// Decrement stock
				await updateSupply(supply.id, { body: { currentStock: newStock, _v: supply._v } });

				// Record revenue if price set
				if (revenue > 0) {
					await createRevenue({
						body: {
							entityType: 'building',
							entityId: building.id,
							entityName: building.name || '',
							date: dateEl.elem.value,
							amount: revenue,
							type: 'Inventory sale',
							description: `${qty} ${supply.unit || 'units'} of ${supply.name} @ $${price.toFixed(2)}/${supply.unit || 'unit'}`,
							notes: notesEl.elem.value,
						},
					});
				}

				refresh();
			}

			dialog.close();
		},
	});

	// On-hand indicator
	new Elem({
		tag: 'div',
		appendTo: dialog.body,
		style: { fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' },
		textContent: `${onHand} ${supply.unit || 'units'} currently on hand`,
	});

	// Qty + Price + Date grid
	const grid = new Elem({
		tag: 'div',
		appendTo: dialog.body,
		style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' },
	});

	new FormLabel({ appendTo: grid, textContent: `Qty (max ${onHand})` });
	const qtyEl = new FormInput({
		appendTo: grid,
		type: 'number',
		step: '0.1',
		min: '0.01',
		max: String(onHand),
		placeholder: '0',
	});

	new FormLabel({ appendTo: grid, textContent: `Price / ${supply.unit || 'unit'} ($)` });
	const priceEl = new FormInput({
		appendTo: grid,
		type: 'number',
		step: '0.01',
		placeholder: costPerUnit ? costPerUnit.toFixed(2) : '0.00',
	});
	if (costPerUnit) priceEl.elem.value = costPerUnit.toFixed(2);

	new FormLabel({ appendTo: grid, textContent: 'Date' });
	const dateEl = new FormInput({ appendTo: grid, type: 'date' });
	dateEl.elem.value = new Date().toISOString().slice(0, 10);

	// Live revenue preview
	const preview = new Elem({
		tag: 'div',
		appendTo: dialog.body,
		style: { fontSize: '13px', color: '#4caf50', marginTop: '10px', minHeight: '18px' },
	});

	const update = () => {
		const q = Number(qtyEl.elem.value),
			p = Number(priceEl.elem.value);

		preview.elem.textContent = q > 0 && p > 0 ? `= ${formatDollar(q * p, 2)} revenue` : '';
	};

	qtyEl.elem.addEventListener('input', update);
	priceEl.elem.addEventListener('input', update);

	// Notes
	new FormLabel({ appendTo: dialog.body, textContent: 'Buyer / Notes' });
	const notesEl = new FormInput({ appendTo: dialog.body, placeholder: 'Optional — buyer name, payment method…' });
}
