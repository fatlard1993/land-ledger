import { Button, Icon, formatDate, theme } from '@vanilla-bean/components';

import { ActionHeader } from '../Layout';
import { formatDollar } from '../utils/format';
import MaintenanceDialog from '../Equipment/MaintenanceDialog';
import MaintenanceScheduleDialog from '../Equipment/MaintenanceScheduleDialog';
import {
	createMaintenance,
	updateMaintenance,
	deleteMaintenance,
	createMaintenanceSchedule,
	updateMaintenanceSchedule,
	deleteMaintenanceSchedule,
	updateEquipment,
} from '../api';
import { scheduleStatus } from '../utils/maintenanceUtils';
import {
	EmptyNote,
	HeaderActions,
	HeaderButton,
	PanelRow,
	RowAside,
	RowMain,
	RowMeta,
	RowTitle,
	SubLabel,
} from './panelParts';

const { colors } = theme;

export async function renderMaintenanceSection(equipment, maintenance, schedules, { refresh, appendTo }) {
	const item = equipment;
	const records = maintenance;
	const today = new Date();
	const currentUsage = Number(item.usage) || 0;

	// Section header with buttons
	const maintenanceHeader = new ActionHeader({ appendTo, title: 'Maintenance' });
	const maintenanceButtons = new HeaderActions({ appendTo: maintenanceHeader });

	new HeaderButton({
		appendTo: maintenanceButtons,
		icon: 'plus',
		textContent: 'Log Work',
		onPointerPress: () =>
			new MaintenanceDialog({
				equipment: item,
				onSave: async data => {
					const result = await createMaintenance({ body: data });

					if (result?.status === 'error') return result;

					if (result?.body) {
						if (data.usageAtService) {
							await updateEquipment(item.id, { body: { usage: data.usageAtService, _v: item._v } });
						}

						await autoRestoreStatus(item, data.workType);
						refresh();
					}
				},
			}),
	});

	new HeaderButton({
		appendTo: maintenanceButtons,
		icon: 'plus',
		textContent: 'Schedule',
		onPointerPress: () =>
			new MaintenanceScheduleDialog({
				equipment: item,
				onSave: async data => {
					const result = await createMaintenanceSchedule({ body: data });

					if (result?.status === 'error') return result;

					refresh();
				},
			}),
	});

	// Schedules section
	if (schedules.length) {
		new SubLabel({ appendTo, textContent: 'Schedules' });

		for (const schedule of schedules.sort((a, b) => (a.name || '').localeCompare(b.name || ''))) {
			const { status, label } = scheduleStatus(schedule, currentUsage, item.usageUnit, today) ?? {
				status: 'ok',
				label: 'Not yet serviced',
			};
			let statusColor;
			if (status === 'overdue') statusColor = colors.danger;
			else if (status === 'due_soon') statusColor = colors.warning;
			else statusColor = colors.success;

			const row = new PanelRow({ appendTo });

			new Icon({
				appendTo: row,
				icon: 'circle',
				style: { flexShrink: '0', marginTop: '3px', fontSize: '10px', color: statusColor },
			});

			const scheduleInfo = new RowMain({ appendTo: row, style: { cursor: 'pointer' } });

			new RowTitle({ appendTo: scheduleInfo, style: { fontWeight: '500' }, textContent: schedule.name });
			new RowMeta({ appendTo: scheduleInfo, style: { color: colors.light(statusColor) }, textContent: label });

			if (schedule.procedure) {
				new RowMeta({
					appendTo: scheduleInfo,
					style: { marginTop: '2px', whiteSpace: 'pre-wrap' },
					textContent: schedule.procedure,
				});
			}

			// Tapping the info opens log dialog (mark done with details)
			scheduleInfo.onPointerPress(() => openScheduleLogDialog(schedule));

			// Edit schedule button
			new Button({
				appendTo: row,
				variant: 'flat',
				icon: 'pen',
				title: 'Edit schedule',
				style: { flexShrink: '0' },
				onPointerPress: () =>
					new MaintenanceScheduleDialog({
						schedule: schedule,
						equipment: item,
						onSave: async data => {
							const result = await updateMaintenanceSchedule(schedule.id, { body: { ...data, _v: schedule._v } });

							if (result?.status === 'error') return result;

							refresh();
						},
						onDelete: async () => {
							const result = await deleteMaintenanceSchedule(schedule.id);

							if (result?.status === 'error') return result;

							refresh();
						},
					}),
			});
		}
	}

	// Log work against a schedule — opens unified dialog prefilled with schedule name
	const openScheduleLogDialog = async schedule => {
		new MaintenanceDialog({
			equipment: item,
			workType: 'maintenance',
			record: { type: schedule.name, date: new Date().toISOString().slice(0, 10) },
			onSave: async data => {
				const result = await createMaintenance({ body: data });

				if (result?.status === 'error') return result;

				await updateMaintenanceSchedule(schedule.id, {
					body: {
						lastDoneDate: data.date,
						lastDoneUsage: data.usageAtService || currentUsage || null,
						_v: schedule._v,
					},
				});

				if (data.usageAtService) {
					await updateEquipment(item.id, { body: { usage: data.usageAtService, _v: item._v } });
				}

				await autoRestoreStatus(item, data.workType);
				refresh();
			},
		});
	};

	// History
	new SubLabel({ appendTo, textContent: records.length ? 'History' : 'No maintenance records yet' });

	for (const rec of records.slice(0, 8)) {
		const row = new PanelRow({ appendTo, addClass: 'interactive' });
		const left = new RowMain({ appendTo: row });

		const wtIcons = { maintenance: '🔩', repair: '🔧', enhancement: '⬆️' };
		const wtLabel = wtIcons[rec.workType] ? `${wtIcons[rec.workType]} ` : '';

		new RowTitle({ appendTo: left, textContent: `${wtLabel}${rec.type || 'Service Record'}` });

		const meta = [];

		if (rec.usageAtService)
			meta.push(`${Number(rec.usageAtService).toLocaleString()}${item.usageUnit ? ' ' + item.usageUnit : ''}`);
		if (rec.cost) meta.push(`${formatDollar(rec.cost)}`);
		if (rec.parts) meta.push(rec.parts);
		if (meta.length) new RowMeta({ appendTo: left, textContent: meta.join(' · ') });
		if (rec.procedure)
			new RowMeta({
				appendTo: left,
				style: { fontStyle: 'italic', marginTop: '2px' },
				textContent: rec.procedure.slice(0, 80) + (rec.procedure.length > 80 ? '…' : ''),
			});

		new RowAside({ appendTo: row, textContent: formatDate(rec.date) || '—' });

		row.onPointerPress(
			() =>
				new MaintenanceDialog({
					record: rec,
					equipment: item,
					onSave: async data => {
						const result = await updateMaintenance(rec.id, { body: { ...data, _v: rec._v } });

						if (result?.status === 'error') return result;

						refresh();
					},
					onDelete: async () => {
						const result = await deleteMaintenance(rec.id);

						if (result?.status === 'error') return result;

						refresh();
					},
				}),
		);
	}

	if (records.length > 8) {
		new EmptyNote({ appendTo, style: { fontSize: '11px' }, textContent: `+${records.length - 8} older records` });
	}
}

export async function autoRestoreStatus(item, workType) {
	const current = item.status;
	let restore = false;

	if (workType === 'maintenance' && current === 'needs_maintenance') restore = true;
	if (workType === 'repair' && (current === 'needs_service' || current === 'out_of_service')) restore = true;

	if (!restore) return;

	// Only mutate local state after server confirms the update
	const result = await updateEquipment(item.id, { body: { status: '', _v: item._v } }).catch(() => null);

	if (result?.body) {
		item.status = '';
	}
}
