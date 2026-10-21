import {
	Component,
	Elem,
	EmptyState,
	formatDate,
	SectionLabel,
	styled,
	theme,
	Toolbar,
} from '@vanilla-bean/components';

import AsyncView from '../AsyncView';

import { getMaintenance, getEquipment, updateMaintenance, deleteMaintenance } from '../api';
import context from '../context';
import { PageView, RecordCard } from '../Layout';
import MaintenanceDialog, { WORK_TYPES } from '../Equipment/MaintenanceDialog';

const { colors } = theme;

const TitleRow = styled(
	Component,
	() => `
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 8px;
		margin-bottom: 4px;
	`,
);

const Cost = styled(
	Component,
	({ colors }) => `
		flex-shrink: 0;
		font-size: 13px;
		font-weight: 600;
		color: ${colors.light(colors.orange)};
	`,
	{ tag: 'span' },
);

const Parts = styled(
	Component,
	({ colors }) => `
		margin-top: 4px;
		overflow: hidden;
		font-size: 12px;
		color: ${colors.gray};
		text-overflow: ellipsis;
		white-space: nowrap;
	`,
);

const workTypeMeta = value => WORK_TYPES.find(w => w.value === value) || WORK_TYPES[0];

export default class Maintenance extends AsyncView {
	_buildView() {
		this.toolbar = new Toolbar({ appendTo: this, variant: 'bar', heading: 'Maintenance History', gap: 8, wrap: false });

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
			new EmptyState({
				appendTo: this.content,
				icon: 'wrench',
				title: 'No maintenance recorded',
				message: 'Log maintenance from the equipment panel on the map',
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
			new SectionLabel({ appendTo: this.content, textContent: String(year) });

			for (const rec of records) this._renderCard(rec);
		}
	}

	_renderCard(rec) {
		const wt = workTypeMeta(rec.workType);
		const equipment = this._equipment?.body?.[rec.equipmentId];
		const equipmentName = equipment?.name || `Equipment (deleted)`;

		const card = new RecordCard({
			appendTo: this.content,
			onPointerPress: () =>
				new MaintenanceDialog({
					record: rec,
					equipment: equipment || { id: rec.equipmentId, name: equipmentName },
					onSave: async data => {
						const result = await updateMaintenance(rec.id, { body: { ...data, _v: rec._v } });

						if (result?.status === 'error') return result;

						if (result?.body && this._maintenance?.body) {
							this._maintenance.body[rec.id] = result.body;
							this._renderList();
						}
					},
					onDelete: async () => {
						const result = await deleteMaintenance(rec.id);

						if (result?.status === 'error') return result;

						if (this._maintenance?.body) delete this._maintenance.body[rec.id];
						context.hasMaintenanceHistory = Object.keys(this._maintenance?.body || {}).length > 0;
						this._renderList();
					},
				}),
		});

		const titleRow = new TitleRow({ appendTo: card });

		new Elem({
			tag: 'div',
			appendTo: titleRow,
			addClass: 'card-title',
			textContent: `${wt.label.split(' ')[0]} ${rec.type || wt.label}`,
		});

		if (rec.cost) {
			new Cost({ appendTo: titleRow, textContent: `$${Number(rec.cost).toLocaleString()}` });
		}

		const meta = new Elem({ tag: 'div', appendTo: card, addClass: 'card-meta' });

		new Elem({
			tag: 'span',
			appendTo: meta,
			style: equipment ? {} : { color: colors.gray, fontStyle: 'italic' },
			textContent: `🚜 ${equipmentName}`,
		});

		if (rec.date) new Elem({ tag: 'span', appendTo: meta, textContent: formatDate(rec.date) });
		if (rec.usageAtService) new Elem({ tag: 'span', appendTo: meta, textContent: String(rec.usageAtService) });

		if (rec.parts) {
			new Parts({ appendTo: card, textContent: rec.parts });
		}
	}
}
