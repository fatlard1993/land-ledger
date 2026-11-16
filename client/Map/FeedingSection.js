import {
	Button,
	Component,
	failureReason,
	formatDate,
	FormDialog,
	Icon,
	Notify,
	parseDate,
	theme,
} from '@vanilla-bean/components';

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
import { ActionHeader } from '../Layout';
import { daysAgoLabel, toDateOnly } from '../utils/dates';
import { stayOpenFor } from '../utils/stayOpenFor';
import { feedIcon } from '../utils/icons';
import { toNum } from '../utils/format.js';
import { numberField } from '../utils/formFields';
import { IconText } from '../statusIcons';
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

const TREAT_SUGGESTIONS = [
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

export function openTreatDialog(field, totalHead, refresh) {
	return new FormDialog({
		header: 'Log Treat / Extra Feeding',
		saveLabel: 'Log',
		data: { feedType: '', amountPerHead: '', amountUnit: 'lbs/hd', date: toDateOnly(), notes: '' },
		inputs: [
			{
				key: 'feedType',
				label: 'What they got',
				placeholder: 'e.g. Hay, Range cake, Apple slices',
				suggestions: TREAT_SUGGESTIONS,
				validate: value => (value ? null : 'Fill in what they got'),
			},
			{
				type: 'group',
				style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: space.sm },
				inputs: [
					{ key: 'amountPerHead', label: 'Amount', placeholder: 'e.g. 2', ...numberField({ step: '0.1' }) },
					{ key: 'amountUnit', label: 'Unit', placeholder: 'lbs/hd, bales…' },
					{ key: 'date', label: 'Date', type: 'date' },
				],
			},
			{ key: 'notes', label: 'Notes', placeholder: 'Optional — why, weather, etc.' },
		],
		onSave: async ({ feedType, amountPerHead, amountUnit, date, notes }) => {
			const stay = stayOpenFor(
				await createFeedingLog({
					body: {
						fieldId: field.id,
						feedType,
						amountPerHead: toNum(amountPerHead),
						amountUnit: amountUnit || 'lbs/hd',
						headCount: totalHead || null,
						type: 'treat',
						date: date || toDateOnly(),
						notes,
					},
				}),
			);

			if (stay !== undefined) return stay;

			refresh();
		},
	});
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
			if (meta.length || supply) {
				const metaRow = new RowMeta({ appendTo: info, textContent: meta.join(' · ') });

				if (supply) {
					if (meta.length) metaRow.elem.append(' · ');
					new IconText({ tag: 'span', appendTo: metaRow, icon: 'box', textContent: supply.name });
				}
			}

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
				variant: 'flat',
				intent: 'success',
				title: 'Mark as fed',
				style: { flexShrink: '0' },
				onPointerPress: async () => {
					const result = await createFeedingLog({
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

					if (result?.status === 'error') {
						new Notify({ intent: 'danger', content: `Couldn't log the feeding: ${failureReason(result)}` });
						return;
					}

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
			'aria-label': log.type === 'treat' ? 'Treat' : 'Scheduled',
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
			style: { flexShrink: '0', color: colors.muted },
			textContent: formatDate(log.date) || '—',
		});

		new Button({
			variant: 'flat',
			icon: 'xmark',
			title: 'Delete this log entry',
			appendTo: row,
			style: { flexShrink: '0', width: '22px', height: '22px', color: colors.gray },
			onPointerPress: async () => {
				const result = await deleteFeedingLog(log.id);

				if (result?.status === 'error') {
					new Notify({ intent: 'danger', textContent: failureReason(result) });

					return;
				}

				refresh();

				// Nothing points at a log, so putting its fields back under a new id restores it as it was
				const { id, _v, ...body } = log;

				new Notify({
					intent: 'success',
					timeout: 10000,
					textContent: 'Deleted the log entry',
					actions: [
						{
							textContent: 'Undo',
							onPointerPress: async () => {
								const restored = await createFeedingLog({ body });

								// A throw keeps the toast and its Undo, and says why
								if (restored?.status === 'error') throw new Error(failureReason(restored));

								refresh();
							},
						},
					],
				});
			},
		});
	}
}
