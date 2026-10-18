import { Elem } from '@vanilla-bean/components';

import AsyncView from '../AsyncView';

import { getMaintenance, getEquipment, updateMaintenance, deleteMaintenance } from '../api';
import context from '../context';
import { PageView, PageToolbar, PageTitle, Card, AppEmptyState, SectionHeader } from '../Layout';
import MaintenanceDialog, { WORK_TYPES } from '../Equipment/MaintenanceDialog';
import { formatDate } from '../utils/dates';

const workTypeMeta = value => WORK_TYPES.find(w => w.value === value) || WORK_TYPES[0];

export default class Maintenance extends AsyncView {
	_buildView() {
		this.toolbar = new PageToolbar({ appendTo: this });
		new PageTitle({ appendTo: this.toolbar, textContent: 'Maintenance History' });

		this.content = new PageView({ appendTo: this });
	}

	_datasources() {
		return { _maintenance: getMaintenance, _equipment: getEquipment };
	}

	_onData() {
		this._renderList();
	}

	_renderList() {
		this.content.empty();

		const allRecords = Object.values(this._maintenance?.body || {}).sort(
			(a, b) => new Date(b.date || 0) - new Date(a.date || 0),
		);

		context.hasMaintenanceHistory = allRecords.length > 0;

		if (!allRecords.length) {
			new AppEmptyState({
				appendTo: this.content,
				icon: '🔧',
				title: 'No maintenance recorded',
				subtitle: 'Log maintenance from the equipment panel on the map',
			});
			return;
		}

		// Group by year
		const byYear = new Map();

		for (const rec of allRecords) {
			const year = rec.date ? new Date(rec.date).getFullYear() : 'Unknown';

			if (!byYear.has(year)) byYear.set(year, []);
			byYear.get(year).push(rec);
		}

		for (const [year, records] of byYear) {
			new SectionHeader({ appendTo: this.content, textContent: String(year) });

			for (const rec of records) this._renderCard(rec);
		}
	}

	_renderCard(rec) {
		const wt = workTypeMeta(rec.workType);
		const equipment = this._equipment?.body?.[rec.equipmentId];
		const equipmentName = equipment?.name || `Equipment (deleted)`;

		const card = new Card({
			appendTo: this.content,
			onPointerPress: () =>
				new MaintenanceDialog({
					record: rec,
					equipment: equipment || { id: rec.equipmentId, name: equipmentName },
					onSave: async data => {
						const result = await updateMaintenance(rec.id, { body: { ...data, _v: rec._v } });

						if (result?.body && this._maintenance?.body) {
							this._maintenance.body[rec.id] = result.body;
							this._renderList();
						}
					},
					onDelete: async () => {
						await deleteMaintenance(rec.id);
						if (this._maintenance?.body) delete this._maintenance.body[rec.id];
						context.hasMaintenanceHistory = Object.keys(this._maintenance?.body || {}).length > 0;
						this._renderList();
					},
				}),
		});

		const titleRow = new Elem({
			tag: 'div',
			appendTo: card,
			style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' },
		});

		new Elem({
			tag: 'div',
			appendTo: titleRow,
			addClass: 'card-title',
			textContent: `${wt.label.split(' ')[0]} ${rec.type || wt.label}`,
		});

		if (rec.cost) {
			new Elem({
				tag: 'span',
				appendTo: titleRow,
				style: { fontSize: '13px', color: '#e8832a', fontWeight: '600', flexShrink: '0', marginLeft: '8px' },
				textContent: `$${Number(rec.cost).toLocaleString()}`,
			});
		}

		const meta = new Elem({ tag: 'div', appendTo: card, addClass: 'card-meta' });

		new Elem({
			tag: 'span',
			appendTo: meta,
			style: {
				color: equipment ? 'var(--color-medium)' : 'rgba(255,255,255,0.25)',
				fontStyle: equipment ? '' : 'italic',
			},
			textContent: `🚜 ${equipmentName}`,
		});

		if (rec.date) new Elem({ tag: 'span', appendTo: meta, textContent: formatDate(rec.date) });
		if (rec.usageAtService) new Elem({ tag: 'span', appendTo: meta, textContent: String(rec.usageAtService) });

		if (rec.parts) {
			new Elem({
				tag: 'div',
				appendTo: card,
				style: {
					fontSize: '12px',
					color: 'rgba(255,255,255,0.4)',
					marginTop: '4px',
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap',
				},
				textContent: rec.parts,
			});
		}
	}
}
