import { Button, Component, Dialog, formatDate, Icon, Input, parseDate, theme } from '@vanilla-bean/components';

import {
	getFeedingSchedules,
	getFeedingLogs,
	getSupplies,
	createFeedingLog,
	updateFeedingSchedule,
	deleteFeedingSchedule,
	deleteFeedingLog,
} from '../api';
import { frequencyLabel, frequencyInterval } from '../Livestock/FeedingScheduleDialog';
import FeedingScheduleDialog from '../Livestock/FeedingScheduleDialog';
import { ActionHeader, FormLabel } from '../Layout';
import { daysAgoLabel, toDateOnly } from '../utils/dates';
import { feedIcon } from '../utils/icons';
import {
	EmptyNote,
	HeaderActions,
	HeaderButton,
	PanelRow,
	RowGlyph,
	RowMain,
	RowMeta,
	RowTitle,
	SubLabel,
} from './panelParts';

const { colors, space } = theme;

export function openTreatDialog(field, totalHead, refresh) {
	const dialog = new Dialog({
		size: 'large',
		header: 'Log Treat / Extra Feeding',
		buttons: ['Log', 'Cancel'],
		onButtonPress: async ({ button }) => {
			if (button === 'Log' && feedTypeEl.elem.value) {
				await createFeedingLog({
					body: {
						fieldId: field.id,
						feedType: feedTypeEl.elem.value,
						amountPerHead: amountEl.elem.value ? Number(amountEl.elem.value) : null,
						amountUnit: unitEl.elem.value || 'lbs/hd',
						headCount: totalHead || null,
						type: 'treat',
						date: dateEl.elem.value || toDateOnly(),
						notes: notesEl.elem.value,
					},
				});
				refresh();
			}
			dialog.close();
		},
	});

	const feedSuggestions = [
		'Hay — Grass',
		'Hay — Alfalfa',
		'Grain — Corn',
		'Range Cake',
		'Mineral Block',
		'Salt',
		'Protein Supplement',
		'Silage',
		'Pellets',
		'Apple / Carrot',
		'Other treat',
	];

	new FormLabel({ appendTo: dialog.body, textContent: 'What they got' });
	const feedTypeEl = new Input({
		appendTo: dialog.body,
		type: 'text',
		placeholder: 'e.g. Hay, Range cake, Apple slices',
		suggestions: feedSuggestions,
	});

	const rowEl = new Component({
		style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: space.sm },
		appendTo: dialog.body,
	});

	new FormLabel({ appendTo: rowEl, textContent: 'Amount' });
	const amountEl = new Input({ appendTo: rowEl, type: 'number', step: '0.1', placeholder: 'e.g. 2' });

	new FormLabel({ appendTo: rowEl, textContent: 'Unit' });
	const unitEl = new Input({ appendTo: rowEl, type: 'text', placeholder: 'lbs/hd, bales…' });
	unitEl.elem.value = 'lbs/hd';

	new FormLabel({ appendTo: rowEl, textContent: 'Date' });
	const dateEl = new Input({ appendTo: rowEl, type: 'date' });
	dateEl.elem.value = toDateOnly();

	new FormLabel({ appendTo: dialog.body, textContent: 'Notes' });
	const notesEl = new Input({ appendTo: dialog.body, type: 'text', placeholder: 'Optional — why, weather, etc.' });
}

export async function renderFeedingSection(field, livestockEvents, refresh, container) {
	const [feedData, logData, supplyData] = await Promise.all([getFeedingSchedules(), getFeedingLogs(), getSupplies()]);

	const schedules = Object.values(feedData?.body || {})
		.filter(s => s.fieldId === field.id)
		.sort((a, b) => (a.feedType || '').localeCompare(b.feedType || ''));

	const logs = Object.values(logData?.body || {})
		.filter(l => l.fieldId === field.id)
		.sort((a, b) => new Date(b.date) - new Date(a.date));

	const supplies = supplyData?.body || {};

	const totalHead = livestockEvents.reduce((sum, e) => {
		try {
			const d = typeof e.details === 'string' ? JSON.parse(e.details) : e.details || {};
			return sum + (Number(d.headCount) || 0);
		} catch {
			return sum;
		}
	}, 0);

	// Section header with action buttons
	const header = new ActionHeader({ appendTo: container, title: 'Feeding' });
	const headerButtons = new HeaderActions({ appendTo: header });

	new HeaderButton({
		appendTo: headerButtons,
		icon: 'plus',
		textContent: 'Schedule',
		onPointerPress: () =>
			new FeedingScheduleDialog({
				fieldId: field.id,
				onSave: async data => {
					const result = await import('../api').then(({ createFeedingSchedule: c }) => c({ body: data }));

					if (result?.status === 'error') return result;

					refresh();
				},
			}),
	});

	new HeaderButton({
		appendTo: headerButtons,
		icon: 'candy-cane',
		textContent: 'Treat',
		title: 'Log a one-time out-of-schedule feeding',
		onPointerPress: () => openTreatDialog(field, totalHead, refresh),
	});

	// Due check: days since last log vs schedule interval
	const isDue = schedule => {
		const interval = frequencyInterval(schedule.frequency);
		if (interval === null) return false;
		const lastLog = logs.find(l => l.scheduleId === schedule.id);
		if (!lastLog) return true;
		return (Date.now() - parseDate(lastLog.date)) / 86_400_000 >= interval;
	};

	if (!schedules.length) {
		new EmptyNote({ appendTo: container, textContent: 'No schedules — tap + Schedule to add' });
	} else {
		for (const schedule of schedules) {
			const supply = schedule.supplyId ? supplies[schedule.supplyId] : null;
			const due = isDue(schedule);
			const lastLog = logs.find(l => l.scheduleId === schedule.id);

			const row = new PanelRow({ appendTo: container });

			new RowGlyph({ appendTo: row, textContent: feedIcon(schedule.feedType) });

			const info = new RowMain({ appendTo: row });

			new RowTitle({ appendTo: info, style: { fontWeight: '500' }, textContent: schedule.feedType || 'Feed' });

			const meta = [];
			if (schedule.amountPerHead) meta.push(`${schedule.amountPerHead} ${schedule.amountUnit || 'lbs/hd'}`);
			if (schedule.frequency) meta.push(frequencyLabel(schedule.frequency));
			if (supply) meta.push(`📦 ${supply.name}`);
			if (meta.length) new RowMeta({ appendTo: info, textContent: meta.join(' · ') });

			if (lastLog) {
				new RowMeta({
					appendTo: info,
					style: due ? { color: colors.light(colors.warning) } : {},
					textContent: `Last: ${daysAgoLabel(lastLog.date)}${due ? ' · due' : ''}`,
				});
			} else {
				new RowMeta({ appendTo: info, style: { color: colors.light(colors.warning) }, textContent: 'Never recorded' });
			}

			new Button({
				appendTo: row,
				icon: 'check',
				title: 'Mark as fed',
				style: { flexShrink: '0', backgroundColor: colors.dark(colors.success) },
				onPointerPress: async () => {
					await createFeedingLog({
						body: {
							scheduleId: schedule.id,
							fieldId: field.id,
							feedType: schedule.feedType,
							amountPerHead: schedule.amountPerHead,
							amountUnit: schedule.amountUnit,
							headCount: totalHead || null,
							type: 'scheduled',
							date: toDateOnly(),
						},
					});
					refresh();
				},
			});

			info.onPointerPress(
				() =>
					new FeedingScheduleDialog({
						schedule: schedule,
						fieldId: field.id,
						onSave: async data => {
							const result = await updateFeedingSchedule(schedule.id, { body: { ...data, _v: schedule._v } });

							if (result?.status === 'error') return result;

							refresh();
						},
						onDelete: async () => {
							const result = await deleteFeedingSchedule(schedule.id);

							if (result?.status === 'error') return result;

							refresh();
						},
					}),
			);
		}
	}

	// Recent feed log — last 5 entries including treats
	const recentLogs = logs.slice(0, 5);

	if (!recentLogs.length) return;

	new SubLabel({ appendTo: container, textContent: 'Recent' });

	for (const log of recentLogs) {
		const row = new RowMeta({
			appendTo: container,
			style: { display: 'flex', gap: space.sm, padding: `${space.xs} 0`, color: colors.muted, alignItems: 'center' },
		});

		new Icon({
			tag: 'span',
			appendTo: row,
			style: { flexShrink: '0' },
			icon: log.type === 'treat' ? 'candy-cane' : 'check',
		});
		new Component({
			tag: 'span',
			appendTo: row,
			style: { flex: '1', minWidth: '0' },
			textContent: `${log.feedType || 'Feed'}${log.amountPerHead ? ` · ${log.amountPerHead} ${log.amountUnit || ''}` : ''}`,
		});
		new Component({
			tag: 'span',
			appendTo: row,
			style: { flexShrink: '0', color: colors.gray },
			textContent: formatDate(log.date) || '—',
		});

		new Button({
			variant: 'flat',
			icon: 'xmark',
			title: 'Delete this log entry',
			appendTo: row,
			style: { flexShrink: '0', width: '22px', height: '22px', color: colors.gray },
			onPointerPress: async () => {
				await deleteFeedingLog(log.id);
				refresh();
			},
		});
	}
}
