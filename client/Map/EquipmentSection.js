import { Button, Component, Elem, formatDate } from '@vanilla-bean/components';

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

export async function renderMaintenanceSection(equipment, maintenance, schedules, { refresh, appendTo }) {
	const item = equipment;
	const records = maintenance;
	const today = new Date();
	const currentUsage = Number(item.usage) || 0;

	// Section header with buttons
	const maintenanceHeader = new ActionHeader({ appendTo, title: 'Maintenance' });
	const maintenanceButtons = new Component({
		appendTo: maintenanceHeader,
		style: { display: 'flex', gap: '6px', marginTop: '10px' },
	});

	new Button({
		appendTo: maintenanceButtons,
		textContent: '+ Log Work',
		style: { fontSize: '12px', padding: '4px 10px' },
		onPointerPress: () =>
			new MaintenanceDialog({
				equipment: item,
				onSave: async data => {
					const result = await createMaintenance({ body: data });

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

	new Button({
		appendTo: maintenanceButtons,
		textContent: '+ Schedule',
		style: { fontSize: '12px', padding: '4px 10px' },
		onPointerPress: () =>
			new MaintenanceScheduleDialog({
				equipment: item,
				onSave: async data => {
					await createMaintenanceSchedule({ body: data });
					refresh();
				},
			}),
	});

	// Schedules section
	if (schedules.length) {
		new Elem({
			tag: 'div',
			appendTo,
			style: {
				fontSize: '11px',
				textTransform: 'uppercase',
				letterSpacing: '.06em',
				color: 'rgba(255,255,255,0.3)',
				padding: '8px 0 4px',
			},
			textContent: 'Schedules',
		});

		for (const schedule of schedules.sort((a, b) => (a.name || '').localeCompare(b.name || ''))) {
			const { status, label } = scheduleStatus(schedule, currentUsage, item.usageUnit, today) ?? {
				status: 'ok',
				label: 'Not yet serviced',
			};
			let statusColor;
			if (status === 'overdue') statusColor = '#e05252';
			else if (status === 'due_soon') statusColor = '#e8c42a';
			else statusColor = '#4caf50';

			let statusIcon;
			if (status === 'overdue') statusIcon = '🔴';
			else if (status === 'due_soon') statusIcon = '🟡';
			else statusIcon = '🟢';

			const row = new Component({
				appendTo,
				style: {
					display: 'flex',
					alignItems: 'flex-start',
					gap: '8px',
					padding: '6px 0',
					borderBottom: '1px solid rgba(255,255,255,0.06)',
				},
			});

			new Elem({
				tag: 'span',
				appendTo: row,
				style: { fontSize: '13px', flexShrink: '0', marginTop: '1px' },
				textContent: statusIcon,
			});

			const scheduleInfo = new Component({ appendTo: row, style: { flex: '1', minWidth: '0', cursor: 'pointer' } });

			new Elem({
				tag: 'div',
				appendTo: scheduleInfo,
				style: { fontSize: '13px', color: '#fff', fontWeight: '500' },
				textContent: schedule.name,
			});
			new Elem({
				tag: 'div',
				appendTo: scheduleInfo,
				style: { fontSize: '11px', color: statusColor },
				textContent: label,
			});

			if (schedule.procedure) {
				new Elem({
					tag: 'div',
					appendTo: scheduleInfo,
					style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px', whiteSpace: 'pre-wrap' },
					textContent: schedule.procedure,
				});
			}

			// Tapping the info opens log dialog (mark done with details)
			scheduleInfo.onPointerPress(() => openScheduleLogDialog(schedule));

			// Edit schedule button
			new Button({
				appendTo: row,
				textContent: '✏️',
				title: 'Edit schedule',
				style: {
					fontSize: '12px',
					padding: '2px 6px',
					background: 'transparent',
					border: '1px solid rgba(255,255,255,0.1)',
					flexShrink: '0',
				},
				onPointerPress: () =>
					new MaintenanceScheduleDialog({
						schedule: schedule,
						equipment: item,
						onSave: async data => {
							await updateMaintenanceSchedule(schedule.id, { body: { ...data, _v: schedule._v } });
							refresh();
						},
						onDelete: async () => {
							await deleteMaintenanceSchedule(schedule.id);
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
				await createMaintenance({ body: data });
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
	new Elem({
		tag: 'div',
		appendTo,
		style: {
			fontSize: '11px',
			textTransform: 'uppercase',
			letterSpacing: '.06em',
			color: 'rgba(255,255,255,0.3)',
			padding: '8px 0 4px',
		},
		textContent: records.length ? 'History' : 'No maintenance records yet',
	});

	for (const rec of records.slice(0, 8)) {
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

		const wtIcons = { maintenance: '🔩', repair: '🔧', enhancement: '⬆️' };
		const wtLabel = wtIcons[rec.workType] ? `${wtIcons[rec.workType]} ` : '';

		new Elem({
			tag: 'div',
			appendTo: left,
			style: { fontSize: '13px', color: '#fff' },
			textContent: `${wtLabel}${rec.type || 'Service Record'}`,
		});

		const meta = [];

		if (rec.usageAtService)
			meta.push(`${Number(rec.usageAtService).toLocaleString()}${item.usageUnit ? ' ' + item.usageUnit : ''}`);
		if (rec.cost) meta.push(`${formatDollar(rec.cost)}`);
		if (rec.parts) meta.push(rec.parts);
		if (meta.length)
			new Elem({
				tag: 'div',
				appendTo: left,
				style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)' },
				textContent: meta.join(' · '),
			});
		if (rec.procedure)
			new Elem({
				tag: 'div',
				appendTo: left,
				style: { fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginTop: '2px' },
				textContent: rec.procedure.slice(0, 80) + (rec.procedure.length > 80 ? '…' : ''),
			});

		new Elem({
			tag: 'div',
			appendTo: row,
			style: {
				fontSize: '11px',
				color: 'rgba(255,255,255,0.35)',
				whiteSpace: 'nowrap',
				paddingLeft: '8px',
				marginTop: '2px',
			},
			textContent: formatDate(rec.date) || '—',
		});

		row.onPointerPress(
			() =>
				new MaintenanceDialog({
					record: rec,
					equipment: item,
					onSave: async data => {
						await updateMaintenance(rec.id, { body: { ...data, _v: rec._v } });
						refresh();
					},
					onDelete: async () => {
						await deleteMaintenance(rec.id);
						refresh();
					},
				}),
		);
	}

	if (records.length > 8) {
		new Elem({
			tag: 'div',
			appendTo,
			style: { fontSize: '11px', color: 'rgba(255,255,255,0.3)', padding: '4px 0' },
			textContent: `+${records.length - 8} older records`,
		});
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
