import { Button, Component, Elem, EmptyState, Icon, styled } from '@vanilla-bean/components';

import AsyncView from '../AsyncView';

import { getSupplies, getBuildings, createSupply, updateSupply, deleteSupply } from '../api';
import context from '../context';
import { PageView, PageToolbar, PageTitle } from '../Layout';

import TabularImportDialog from '../Import/TabularImportDialog';
import ExportDialog from '../Export/ExportDialog';
import SupplyDialog, { detectSupplyEmoji } from './SupplyDialog';

const format = n => n?.toFixed?.(2) ?? '0.00';

const InventoryCard = styled(
	Component,
	({ colors }) => `
		background: ${colors.darker(colors.gray)};
		border: 1px solid ${colors.dark(colors.gray)};
		border-radius: 8px;
		padding: 10px 12px;
		margin-bottom: 6px;
		cursor: pointer;
		transition: border-color 0.15s;
		display: flex;
		align-items: center;
		gap: 10px;

		&:hover { border-color: ${colors.light(colors.blue)}; }

		& .supply-name { font-size: 14px; font-weight: 600; color: ${colors.white}; flex: 1; }
		& .supply-meta { font-size: 12px; color: ${colors.gray}; }
		& .supply-cost { font-size: 13px; color: ${colors.light(colors.green)}; white-space: nowrap; }
		& .supply-stock { font-size: 12px; color: ${colors.gray}; white-space: nowrap; }
	`,
);

export default class Supplies extends AsyncView {
	_buildView() {
		this.toolbar = new PageToolbar({ appendTo: this });
		new PageTitle({ appendTo: this.toolbar, textContent: 'Supplies' });
		new Button({
			appendTo: this.toolbar,
			append: new Icon({ icon: 'file-import' }),
			title: 'Import CSV / JSON',
			onPointerPress: () => new TabularImportDialog({ initialCollection: 'supplies' }),
		});

		new Button({
			appendTo: this.toolbar,
			append: new Icon({ icon: 'file-export' }),
			title: 'Export data',
			onPointerPress: () => new ExportDialog(),
		});

		new Button({
			appendTo: this.toolbar,
			append: new Icon({ icon: 'plus' }),
			title: 'Add supply item',
			onPointerPress: () =>
				new SupplyDialog({
					onSave: async data => {
						const result = await createSupply({ body: data });

						if (result?.body && this.supplies?.body) {
							this.supplies.body[result.body.id] = result.body;
							context.hasSupplies = true;
							this._renderList();
						}
					},
				}),
		});

		this.content = new PageView({ appendTo: this });
	}

	_datasources() {
		return { supplies: getSupplies, buildings: getBuildings };
	}

	_onData() {
		this._renderList();
	}

	_renderList() {
		this.content.empty();

		const supplyList = Object.values(this.supplies?.body || {});

		if (!supplyList.length) {
			new EmptyState({
				appendTo: this.content,
				icon: 'box',
				title: 'No supplies yet',
				message: 'Track seed, fertilizer, amendments, and other inputs with costs and stock levels',
			});
			return;
		}

		// Summary bar
		const totalValue = supplyList.reduce(
			(sum, s) => sum + (Number(s.costPerUnit) || 0) * (Number(s.currentStock) || 0),
			0,
		);
		const categoryCounts = {};

		for (const s of supplyList) categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;

		const summary = new Component({
			appendTo: this.content,
			style: {
				background: 'rgba(255,255,255,0.03)',
				border: '1px solid rgba(255,255,255,0.08)',
				borderRadius: '6px',
				padding: '8px 12px',
				marginBottom: '10px',
				display: 'flex',
				flexWrap: 'wrap',
				gap: '10px',
				fontSize: '12px',
			},
		});

		new Elem({
			tag: 'span',
			appendTo: summary,
			style: { color: 'rgba(255,255,255,0.5)' },
			textContent: `${supplyList.length} items`,
		});

		if (totalValue > 0) {
			new Elem({
				tag: 'span',
				appendTo: summary,
				style: { color: '#4caf50', fontWeight: '600' },
				textContent: `$${totalValue.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} inventory value`,
			});
		}

		// Group by category
		const grouped = new Map();

		for (const s of supplyList.sort((a, b) => (a.name || '').localeCompare(b.name || ''))) {
			const cat = s.category || 'Other';

			if (!grouped.has(cat)) grouped.set(cat, []);

			grouped.get(cat).push(s);
		}

		for (const [cat, items] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
			const catEmoji = detectSupplyEmoji(cat);

			new Elem({
				tag: 'div',
				appendTo: this.content,
				style: {
					fontSize: '11px',
					textTransform: 'uppercase',
					letterSpacing: '.07em',
					color: 'rgba(255,255,255,0.35)',
					padding: '10px 0 4px',
				},
				textContent: `${catEmoji} ${cat}`,
			});

			for (const supply of items) {
				const building = this.buildings?.body?.[supply.buildingId];
				const emoji = detectSupplyEmoji(supply.category, supply.emoji);

				const card = new InventoryCard({
					appendTo: this.content,
					onPointerPress: () =>
						new SupplyDialog({
							supply,
							onSave: async data => {
								const result = await updateSupply(supply.id, { body: { ...data, _v: supply._v } });

								if (result?.body && this.supplies?.body) {
									this.supplies.body[supply.id] = result.body;
									this._renderList();
								}
							},
							onDelete: async () => {
								await deleteSupply(supply.id);
								if (this.supplies?.body) delete this.supplies.body[supply.id];
								context.hasSupplies = Object.keys(this.supplies?.body || {}).length > 0;
								this._renderList();
							},
						}),
				});

				new Elem({ tag: 'span', appendTo: card, style: { fontSize: '16px', flexShrink: '0' }, textContent: emoji });

				const info = new Component({ appendTo: card, style: { flex: '1', minWidth: '0' } });

				new Elem({ tag: 'div', appendTo: info, addClass: 'supply-name', textContent: supply.name });

				const metaLine = new Component({ appendTo: info, style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } });

				if (supply.costPerUnit) {
					new Elem({
						tag: 'span',
						appendTo: metaLine,
						addClass: 'supply-meta',
						textContent: `$${format(Number(supply.costPerUnit))}/${supply.unit || 'unit'}`,
					});
				}

				if (building) {
					new Elem({ tag: 'span', appendTo: metaLine, addClass: 'supply-meta', textContent: `📍 ${building.name}` });
				}

				if (supply.currentStock) {
					const stockVal = Number(supply.currentStock);
					const costVal = stockVal * (Number(supply.costPerUnit) || 0);

					new Elem({
						tag: 'div',
						appendTo: card,
						style: { textAlign: 'right', flexShrink: '0' },
					}).elem.innerHTML =
						`<div class="supply-stock">${stockVal} ${supply.unit || ''}</div>${costVal > 0 ? `<div class="supply-cost">$${costVal.toFixed(0)}</div>` : ''}`;
				}
			}
		}
	}
}
