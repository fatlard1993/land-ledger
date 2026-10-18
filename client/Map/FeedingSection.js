import { Component, Elem, Button, Dialog } from '@vanilla-bean/components';

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
import { SectionHeader, FormLabel, FormInput } from '../Layout';

const formatDate = dateStr => {
	if (!dateStr) return '—';
	const d = new Date(`${dateStr}T12:00:00`);
	return isNaN(d) ? dateStr : d.toLocaleDateString();
};

const feedIcon = ft => {
	if (/hay|straw|forage/i.test(ft)) return '🌾';
	if (/silage|haylage/i.test(ft)) return '🌽';
	if (/grain|corn|oat|barley/i.test(ft)) return '🌾';
	if (/mineral|salt/i.test(ft)) return '🧂';
	if (/supplement|protein|cake/i.test(ft)) return '💊';
	if (/pasture/i.test(ft)) return '🌿';
	return '🍽️';
};

export function openTreatDialog(field, totalHead, refresh) {
	const dialog = new Dialog({
		size: 'large',
		header: '🍬 Log Treat / Extra Feeding',
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
						date: dateEl.elem.value || new Date().toISOString().slice(0, 10),
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
	const feedTypeEl = new FormInput({
		appendTo: dialog.body,
		type: 'text',
		placeholder: 'e.g. Hay, Range cake, Apple slices',
		suggestions: feedSuggestions,
	});

	const rowEl = new Elem({
		tag: 'div',
		style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' },
		appendTo: dialog.body,
	});

	new FormLabel({ appendTo: rowEl, textContent: 'Amount' });
	const amountEl = new FormInput({ appendTo: rowEl, type: 'number', step: '0.1', placeholder: 'e.g. 2' });

	new FormLabel({ appendTo: rowEl, textContent: 'Unit' });
	const unitEl = new FormInput({ appendTo: rowEl, type: 'text', placeholder: 'lbs/hd, bales…' });
	unitEl.elem.value = 'lbs/hd';

	new FormLabel({ appendTo: rowEl, textContent: 'Date' });
	const dateEl = new FormInput({ appendTo: rowEl, type: 'date' });
	dateEl.elem.value = new Date().toISOString().slice(0, 10);

	new FormLabel({ appendTo: dialog.body, textContent: 'Notes' });
	const notesEl = new FormInput({ appendTo: dialog.body, type: 'text', placeholder: 'Optional — why, weather, etc.' });
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
	const header = new Component({
		appendTo: container,
		style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
	});

	new SectionHeader({ appendTo: header, textContent: '🐄 Feeding' });

	const headerButtons = new Component({ appendTo: header, style: { display: 'flex', gap: '5px', marginTop: '10px' } });

	new Button({
		appendTo: headerButtons,
		textContent: '+ Schedule',
		style: { fontSize: '11px', padding: '3px 8px' },
		onPointerPress: () =>
			new FeedingScheduleDialog({
				fieldId: field.id,
				onSave: async data => {
					await import('../api').then(({ createFeedingSchedule: c }) => c({ body: data }));
					refresh();
				},
			}),
	});

	new Button({
		appendTo: headerButtons,
		textContent: '🍬 Treat',
		title: 'Log a one-time out-of-schedule feeding',
		style: { fontSize: '11px', padding: '3px 8px' },
		onPointerPress: () => openTreatDialog(field, totalHead, refresh),
	});

	// Due check: days since last log vs schedule interval
	const isDue = schedule => {
		const interval = frequencyInterval(schedule.frequency);
		if (interval === null) return false;
		const lastLog = logs.find(l => l.scheduleId === schedule.id);
		if (!lastLog) return true;
		return (Date.now() - new Date(lastLog.date)) / 86_400_000 >= interval;
	};

	if (!schedules.length) {
		new Elem({
			tag: 'div',
			appendTo: container,
			style: { fontSize: '12px', color: 'rgba(255,255,255,0.25)', padding: '4px 0' },
			textContent: 'No schedules — tap + Schedule to add',
		});
	} else {
		for (const schedule of schedules) {
			const supply = schedule.supplyId ? supplies[schedule.supplyId] : null;
			const due = isDue(schedule);
			const lastLog = logs.find(l => l.scheduleId === schedule.id);

			const row = new Component({
				appendTo: container,
				style: {
					display: 'flex',
					alignItems: 'flex-start',
					gap: '8px',
					padding: '7px 0',
					borderBottom: '1px solid rgba(255,255,255,0.06)',
				},
			});

			new Elem({
				tag: 'span',
				appendTo: row,
				style: { fontSize: '15px', flexShrink: '0', marginTop: '1px' },
				textContent: feedIcon(schedule.feedType),
			});

			const info = new Component({ appendTo: row, style: { flex: '1', minWidth: '0' } });

			new Elem({
				tag: 'div',
				appendTo: info,
				style: { fontSize: '13px', color: '#fff', fontWeight: '500' },
				textContent: schedule.feedType || 'Feed',
			});

			const meta = [];
			if (schedule.amountPerHead) meta.push(`${schedule.amountPerHead} ${schedule.amountUnit || 'lbs/hd'}`);
			if (schedule.frequency) meta.push(frequencyLabel(schedule.frequency));
			if (supply) meta.push(`📦 ${supply.name}`);
			if (meta.length)
				new Elem({
					tag: 'div',
					appendTo: info,
					style: { fontSize: '11px', color: 'rgba(255,255,255,0.45)' },
					textContent: meta.join(' · '),
				});

			if (lastLog) {
				const daysAgo = Math.floor((Date.now() - new Date(lastLog.date)) / 86_400_000);
				let daysLabel;
				if (daysAgo === 0) daysLabel = 'today';
				else if (daysAgo === 1) daysLabel = 'yesterday';
				else daysLabel = `${daysAgo}d ago`;
				new Elem({
					tag: 'div',
					appendTo: info,
					style: { fontSize: '11px', color: due ? '#e8c42a' : 'rgba(255,255,255,0.3)' },
					textContent: `Last: ${daysLabel}${due ? ' · due' : ''}`,
				});
			} else {
				new Elem({
					tag: 'div',
					appendTo: info,
					style: { fontSize: '11px', color: '#e8c42a' },
					textContent: 'Never recorded',
				});
			}

			new Button({
				appendTo: row,
				textContent: '✓',
				title: 'Mark as fed',
				style: {
					fontSize: '14px',
					padding: '4px 8px',
					flexShrink: '0',
					background: 'rgba(76,175,80,0.15)',
					border: '1px solid rgba(76,175,80,0.45)',
					color: '#4caf50',
				},
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
							date: new Date().toISOString().slice(0, 10),
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
							await updateFeedingSchedule(schedule.id, { body: { ...data, _v: schedule._v } });
							refresh();
						},
						onDelete: async () => {
							await deleteFeedingSchedule(schedule.id);
							refresh();
						},
					}),
			);
		}
	}

	// Recent feed log — last 5 entries including treats
	const recentLogs = logs.slice(0, 5);

	if (!recentLogs.length) return;

	new Elem({
		tag: 'div',
		appendTo: container,
		style: {
			fontSize: '10px',
			textTransform: 'uppercase',
			letterSpacing: '.06em',
			color: 'rgba(255,255,255,0.25)',
			padding: '8px 0 3px',
		},
		textContent: 'Recent',
	});

	for (const log of recentLogs) {
		const row = new Component({
			appendTo: container,
			style: {
				display: 'flex',
				gap: '7px',
				fontSize: '11px',
				padding: '3px 0',
				color: 'rgba(255,255,255,0.5)',
				alignItems: 'center',
			},
		});

		new Elem({
			tag: 'span',
			appendTo: row,
			style: { flexShrink: '0' },
			textContent: log.type === 'treat' ? '🍬' : '✓',
		});
		new Elem({
			tag: 'span',
			appendTo: row,
			style: { flex: '1' },
			textContent: `${log.feedType || 'Feed'}${log.amountPerHead ? ` · ${log.amountPerHead} ${log.amountUnit || ''}` : ''}`,
		});
		new Elem({
			tag: 'span',
			appendTo: row,
			style: { flexShrink: '0', color: 'rgba(255,255,255,0.25)' },
			textContent: formatDate(log.date),
		});

		new Component({
			tag: 'button',
			textContent: '×',
			title: 'Delete this log entry',
			appendTo: row,
			style: {
				background: 'none',
				border: 'none',
				color: 'rgba(255,255,255,0.2)',
				fontSize: '14px',
				cursor: 'pointer',
				padding: '0 2px',
				flexShrink: '0',
				lineHeight: '1',
			},
			onPointerPress: async () => {
				await deleteFeedingLog(log.id);
				refresh();
			},
		});
	}
}
