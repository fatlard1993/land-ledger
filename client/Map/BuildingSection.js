import { Button, Component, Elem, formatDate } from '@vanilla-bean/components';

import { ActionHeader, SectionHeader } from '../Layout';
import { formatDollar } from '../utils/format';
import SupplyDialog, { detectSupplyEmoji } from '../Supplies/SupplyDialog';
import BudgetItemDialog, { annualAmount, FREQUENCIES } from '../Budget/BudgetItemDialog';
import {
	getSupplies,
	createSupply,
	updateSupply,
	deleteSupply,
	getBudgetItems,
	createBudgetItem,
	updateBudgetItem,
	deleteBudgetItem,
	getRevenue,
	createRevenue,
	updateRevenue,
	deleteRevenue,
} from '../api';
import { openRevenueDialog } from './EntityRevenue';

export async function renderBuildingInventory(building, refresh, appendTo) {
	const data = await getSupplies();
	const supplies = Object.values(data?.body || {})
		.filter(s => s.buildingId === building.id)
		.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

	const header = new ActionHeader({ appendTo, title: 'Inventory' });

	new Button({
		appendTo: header,
		textContent: '+ Add',
		style: { fontSize: '12px', padding: '4px 10px', marginTop: '10px' },
		onPointerPress: () =>
			new SupplyDialog({
				buildingId: building.id,
				onSave: async d => {
					await createSupply({ body: { ...d, buildingId: building.id } });
					refresh();
				},
			}),
	});

	if (!supplies.length) {
		new Elem({
			tag: 'div',
			appendTo,
			style: { fontSize: '12px', color: 'rgba(255,255,255,0.25)', padding: '4px 0 8px' },
			textContent: 'No inventory items',
		});
		return;
	}

	for (const s of supplies) {
		const emoji = detectSupplyEmoji(s.category, s.emoji);
		const row = new Component({
			appendTo,
			style: {
				display: 'flex',
				alignItems: 'center',
				gap: '8px',
				padding: '5px 0',
				borderBottom: '1px solid rgba(255,255,255,0.06)',
				cursor: 'pointer',
			},
		});

		new Elem({ tag: 'span', appendTo: row, style: { fontSize: '14px', flexShrink: '0' }, textContent: emoji });

		const info = new Component({ appendTo: row, style: { flex: '1', minWidth: '0' } });

		new Elem({ tag: 'div', appendTo: info, style: { fontSize: '13px', color: '#fff' }, textContent: s.name });

		if (s.currentStock != null && s.currentStock !== '') {
			new Elem({
				tag: 'div',
				appendTo: info,
				style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)' },
				textContent: `${s.currentStock} ${s.unit || ''}`.trim(),
			});
		}

		row.onPointerPress(
			() =>
				new SupplyDialog({
					supply: s,
					buildingId: building.id,
					onSave: async d => {
						await updateSupply(s.id, { body: { ...d, buildingId: building.id, _v: s._v } });
						refresh();
					},
					onDelete: async () => {
						await deleteSupply(s.id);
						refresh();
					},
				}),
		);
	}
}

export async function renderEntityRevenue(entityType, entity, refresh, appendTo) {
	const INCOME_TYPES_BY_TYPE = {
		building: [
			'Rental',
			'Event hosting',
			'Airbnb / Short-term rental',
			'Storage rental',
			'Filming / Photography',
			'Agri-tourism',
			'Other',
		],
		equipment: [
			'Custom hire / contract work',
			'Equipment rental',
			'Neighbor loan',
			'Hay baling',
			'Spraying contract',
			'Tillage contract',
			'Transport',
			'Other',
		],
	};

	const data = await getRevenue();
	const entries = Object.values(data?.body || {})
		.filter(r => r.entityType === entityType && r.entityId === entity.id)
		.sort((a, b) => new Date(b.date) - new Date(a.date));

	const totalYTD = entries
		.filter(r => r.date?.startsWith(String(new Date().getFullYear())))
		.reduce((s, r) => s + (Number(r.amount) || 0), 0);

	const header = new Component({
		appendTo,
		style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
	});

	new SectionHeader({ appendTo: header, textContent: '💰 Income' });

	const hRight = new Component({
		appendTo: header,
		style: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' },
	});

	if (totalYTD > 0)
		new Elem({
			tag: 'span',
			appendTo: hRight,
			style: { fontSize: '12px', color: '#4caf50' },
			textContent: `${formatDollar(totalYTD)} YTD`,
		});

	new Button({
		appendTo: hRight,
		textContent: '+ Record',
		style: { fontSize: '11px', padding: '3px 8px' },
		onPointerPress: () =>
			openRevenueDialog(
				entityType,
				entity,
				null,
				async d => {
					await createRevenue({ body: d });
					refresh();
				},
				null,
				INCOME_TYPES_BY_TYPE[entityType],
			),
	});

	if (!entries.length) {
		new Elem({
			tag: 'div',
			appendTo,
			style: { fontSize: '12px', color: 'rgba(255,255,255,0.25)', padding: '4px 0 8px' },
			textContent: 'No income recorded',
		});
		return;
	}

	for (const rec of entries.slice(0, 8)) {
		const row = new Component({
			appendTo,
			style: {
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'flex-start',
				padding: '5px 0',
				borderBottom: '1px solid rgba(255,255,255,0.06)',
				cursor: 'pointer',
			},
		});

		const left = new Component({ appendTo: row, style: { flex: '1', minWidth: '0' } });

		new Elem({
			tag: 'div',
			appendTo: left,
			style: { fontSize: '13px', color: '#fff' },
			textContent: rec.type || 'Income',
		});
		if (rec.description)
			new Elem({
				tag: 'div',
				appendTo: left,
				style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)' },
				textContent: rec.description,
			});

		const right = new Component({ appendTo: row, style: { textAlign: 'right', flexShrink: '0', paddingLeft: '10px' } });

		new Elem({
			tag: 'div',
			appendTo: right,
			style: { fontSize: '13px', color: '#4caf50', fontWeight: '600' },
			textContent: `${formatDollar(rec.amount)}`,
		});
		new Elem({
			tag: 'div',
			appendTo: right,
			style: { fontSize: '11px', color: 'rgba(255,255,255,0.3)' },
			textContent: formatDate(rec.date) || '—',
		});

		row.onPointerPress(() =>
			openRevenueDialog(
				entityType,
				entity,
				rec,
				async d => {
					await updateRevenue(rec.id, { body: { ...d, _v: rec._v } });
					refresh();
				},
				async () => {
					await deleteRevenue(rec.id);
					refresh();
				},
				INCOME_TYPES_BY_TYPE[entityType],
			),
		);
	}
}

export async function renderBudgetItems(entityType, entity, refresh, appendTo) {
	const data = await getBudgetItems();
	const items = Object.values(data?.body || {})
		.filter(
			i => !entityType || (i.entityType === entityType && i.entityId === entity?.id) || (!i.entityType && !entityType),
		)
		.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

	const entityItems = entity ? items.filter(i => i.entityType === entityType && i.entityId === entity.id) : items;

	const incItems = entityItems.filter(i => i.type === 'income');
	const expItems = entityItems.filter(i => i.type === 'expense');
	const totalInc = incItems.reduce((s, i) => s + annualAmount(i), 0);
	const totalExp = expItems.reduce((s, i) => s + annualAmount(i), 0);

	const header = new ActionHeader({ appendTo, title: '📋 Budget' });

	const hRight = new Component({
		appendTo: header,
		style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' },
	});

	if (totalInc > 0)
		new Elem({
			tag: 'span',
			appendTo: hRight,
			style: { fontSize: '11px', color: '#4caf50' },
			textContent: `+${formatDollar(totalInc)}/yr`,
		});
	if (totalExp > 0)
		new Elem({
			tag: 'span',
			appendTo: hRight,
			style: { fontSize: '11px', color: '#e8c42a' },
			textContent: `-${formatDollar(totalExp)}/yr`,
		});

	new Button({
		appendTo: hRight,
		textContent: '+ Add',
		style: { fontSize: '11px', padding: '3px 8px' },
		onPointerPress: () =>
			new BudgetItemDialog({
				entityType,
				entity,
				onSave: async d => {
					await createBudgetItem({ body: d });
					refresh();
				},
			}),
	});

	if (!entityItems.length) {
		new Elem({
			tag: 'div',
			appendTo,
			style: { fontSize: '12px', color: 'rgba(255,255,255,0.25)', padding: '4px 0 8px' },
			textContent: 'No recurring budget items',
		});
		return;
	}

	for (const section of [
		{ items: incItems, color: '#4caf50', label: 'Income' },
		{ items: expItems, color: '#e8c42a', label: 'Expenses' },
	]) {
		if (!section.items.length) continue;

		new Elem({
			tag: 'div',
			appendTo,
			style: {
				fontSize: '10px',
				textTransform: 'uppercase',
				letterSpacing: '.06em',
				color: 'rgba(255,255,255,0.25)',
				padding: '6px 0 2px',
			},
			textContent: section.label,
		});

		for (const bi of section.items) {
			const freq = FREQUENCIES.find(f => f.value === bi.frequency);
			const row = new Component({
				appendTo,
				style: {
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'flex-start',
					padding: '5px 0',
					borderBottom: '1px solid rgba(255,255,255,0.06)',
					cursor: 'pointer',
				},
			});
			const left = new Component({ appendTo: row, style: { flex: '1', minWidth: '0' } });

			new Elem({ tag: 'div', appendTo: left, style: { fontSize: '13px', color: '#fff' }, textContent: bi.name });
			if (bi.category)
				new Elem({
					tag: 'div',
					appendTo: left,
					style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)' },
					textContent: bi.category,
				});

			const right = new Component({
				appendTo: row,
				style: { textAlign: 'right', flexShrink: '0', paddingLeft: '8px' },
			});

			new Elem({
				tag: 'div',
				appendTo: right,
				style: { fontSize: '13px', color: section.color, fontWeight: '600' },
				textContent: `${formatDollar(bi.amount)}/${freq?.label?.toLowerCase() || bi.frequency}`,
			});
			new Elem({
				tag: 'div',
				appendTo: right,
				style: { fontSize: '10px', color: 'rgba(255,255,255,0.25)' },
				textContent: `${formatDollar(annualAmount(bi))}/yr`,
			});

			row.onPointerPress(
				() =>
					new BudgetItemDialog({
						item: bi,
						entityType,
						entity,
						onSave: async d => {
							await updateBudgetItem(bi.id, { body: { ...d, _v: bi._v } });
							refresh();
						},
						onDelete: async () => {
							await deleteBudgetItem(bi.id);
							refresh();
						},
					}),
			);
		}
	}
}
