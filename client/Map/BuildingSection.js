import { Component, formatDate, theme } from '@vanilla-bean/components';

import { ActionHeader } from '../Layout';
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
import {
	EmptyNote,
	HeaderActions,
	HeaderButton,
	PanelRow,
	RowAside,
	RowGlyph,
	RowMain,
	RowMeta,
	RowTitle,
	SubLabel,
} from './panelParts';

const { colors, space } = theme;

export async function renderBuildingInventory(building, refresh, appendTo) {
	const data = await getSupplies();
	const supplies = Object.values(data?.body || {})
		.filter(s => s.buildingId === building.id)
		.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

	const header = new ActionHeader({ appendTo, title: 'Inventory' });

	new HeaderButton({
		appendTo: header,
		icon: 'plus',
		textContent: 'Add',
		style: { marginTop: space.md },
		onPointerPress: () =>
			new SupplyDialog({
				buildingId: building.id,
				onSave: async d => {
					const result = await createSupply({ body: { ...d, buildingId: building.id } });

					if (result?.status === 'error') return result;

					refresh();
				},
			}),
	});

	if (!supplies.length) {
		new EmptyNote({ appendTo, textContent: 'No inventory items' });
		return;
	}

	for (const s of supplies) {
		const emoji = detectSupplyEmoji(s.category, s.emoji);
		const row = new PanelRow({ appendTo, addClass: 'interactive', style: { alignItems: 'center' } });

		new RowGlyph({ appendTo: row, style: { marginTop: '0' }, textContent: emoji });

		const info = new RowMain({ appendTo: row });

		new RowTitle({ appendTo: info, textContent: s.name });

		if (s.currentStock != null && s.currentStock !== '') {
			new RowMeta({ appendTo: info, textContent: `${s.currentStock} ${s.unit || ''}`.trim() });
		}

		row.onPointerPress(
			() =>
				new SupplyDialog({
					supply: s,
					buildingId: building.id,
					onSave: async d => {
						const result = await updateSupply(s.id, { body: { ...d, buildingId: building.id, _v: s._v } });

						if (result?.status === 'error') return result;

						refresh();
					},
					onDelete: async () => {
						const result = await deleteSupply(s.id);

						if (result?.status === 'error') return result;

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

	const header = new ActionHeader({ appendTo, title: 'Income' });
	const hRight = new HeaderActions({ appendTo: header, style: { gap: space.md } });

	if (totalYTD > 0)
		new Component({
			tag: 'span',
			appendTo: hRight,
			style: { fontSize: '12px', color: colors.light(colors.success) },
			textContent: `${formatDollar(totalYTD)} YTD`,
		});

	new HeaderButton({
		appendTo: hRight,
		icon: 'plus',
		textContent: 'Record',
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
		new EmptyNote({ appendTo, textContent: 'No income recorded' });
		return;
	}

	for (const rec of entries.slice(0, 8)) {
		const row = new PanelRow({ appendTo, addClass: 'interactive' });
		const left = new RowMain({ appendTo: row });

		new RowTitle({ appendTo: left, textContent: rec.type || 'Income' });
		if (rec.description) new RowMeta({ appendTo: left, textContent: rec.description });

		const right = new RowAside({ appendTo: row, style: { marginTop: '0' } });

		new RowTitle({
			appendTo: right,
			style: { color: colors.light(colors.success), fontWeight: '600' },
			textContent: `${formatDollar(rec.amount)}`,
		});
		new Component({ appendTo: right, textContent: formatDate(rec.date) || '—' });

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

	const header = new ActionHeader({ appendTo, title: 'Budget' });
	const hRight = new HeaderActions({ appendTo: header, style: { gap: space.sm } });

	if (totalInc > 0)
		new Component({
			tag: 'span',
			appendTo: hRight,
			style: { fontSize: '11px', color: colors.light(colors.success) },
			textContent: `+${formatDollar(totalInc)}/yr`,
		});
	if (totalExp > 0)
		new Component({
			tag: 'span',
			appendTo: hRight,
			style: { fontSize: '11px', color: colors.light(colors.warning) },
			textContent: `-${formatDollar(totalExp)}/yr`,
		});

	new HeaderButton({
		appendTo: hRight,
		icon: 'plus',
		textContent: 'Add',
		onPointerPress: () =>
			new BudgetItemDialog({
				entityType,
				entity,
				onSave: async d => {
					const result = await createBudgetItem({ body: d });

					if (result?.status === 'error') return result;

					refresh();
				},
			}),
	});

	if (!entityItems.length) {
		new EmptyNote({ appendTo, textContent: 'No recurring budget items' });
		return;
	}

	for (const section of [
		{ items: incItems, color: colors.light(colors.success), label: 'Income' },
		{ items: expItems, color: colors.light(colors.warning), label: 'Expenses' },
	]) {
		if (!section.items.length) continue;

		new SubLabel({ appendTo, textContent: section.label });

		for (const bi of section.items) {
			const freq = FREQUENCIES.find(f => f.value === bi.frequency);
			const row = new PanelRow({ appendTo, addClass: 'interactive' });
			const left = new RowMain({ appendTo: row });

			new RowTitle({ appendTo: left, textContent: bi.name });
			if (bi.category) new RowMeta({ appendTo: left, textContent: bi.category });

			const right = new RowAside({ appendTo: row, style: { marginTop: '0' } });

			new RowTitle({
				appendTo: right,
				style: { color: section.color, fontWeight: '600' },
				textContent: `${formatDollar(bi.amount)}/${freq?.label?.toLowerCase() || bi.frequency}`,
			});
			new Component({
				appendTo: right,
				style: { fontSize: '10px' },
				textContent: `${formatDollar(annualAmount(bi))}/yr`,
			});

			row.onPointerPress(
				() =>
					new BudgetItemDialog({
						item: bi,
						entityType,
						entity,
						onSave: async d => {
							const result = await updateBudgetItem(bi.id, { body: { ...d, _v: bi._v } });

							if (result?.status === 'error') return result;

							refresh();
						},
						onDelete: async () => {
							const result = await deleteBudgetItem(bi.id);

							if (result?.status === 'error') return result;

							refresh();
						},
					}),
			);
		}
	}
}
