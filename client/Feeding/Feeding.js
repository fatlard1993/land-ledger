import { Elem, Component, Button } from '@vanilla-bean/components';

import AsyncView from '../AsyncView';

import {
	getFeedingLogs,
	getFeedingSchedules,
	getFields,
	getSupplies,
	deleteFeedingLog,
	deleteFeedingSchedule,
	updateFeedingSchedule,
} from '../api';
import context from '../context';
import { PageView, PageToolbar, PageTitle, AppEmptyState, SectionHeader, Card } from '../Layout';
import FeedingScheduleDialog, { frequencyLabel } from '../Livestock/FeedingScheduleDialog';
import { formatDate } from '../utils/dates';

const feedIcon = ft => {
	if (/hay|straw|forage/i.test(ft)) return '🌾';
	if (/silage|haylage/i.test(ft)) return '🌽';
	if (/grain|corn|oat|barley/i.test(ft)) return '🌾';
	if (/mineral|salt/i.test(ft)) return '🧂';
	if (/supplement|protein|cake/i.test(ft)) return '💊';
	if (/pasture/i.test(ft)) return '🌿';
	return '🍽️';
};

export default class Feeding extends AsyncView {
	_buildView() {
		this.toolbar = new PageToolbar({ appendTo: this });
		new PageTitle({ appendTo: this.toolbar, textContent: 'Feeding Records' });

		this.content = new PageView({ appendTo: this });
	}

	_datasources() {
		return { _logs: getFeedingLogs, _schedules: getFeedingSchedules, _fields: getFields, _supplies: getSupplies };
	}

	_onData() {
		this._renderList();
	}

	_fieldName(fieldId) {
		const f = this._fields?.body?.[fieldId];

		return f ? f.name : null;
	}

	_renderList() {
		this.content.empty();

		const allLogs = Object.values(this._logs?.body || {}).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

		const allSchedules = Object.values(this._schedules?.body || {}).sort((a, b) =>
			(a.feedType || '').localeCompare(b.feedType || ''),
		);

		const hasAny = allLogs.length > 0 || allSchedules.length > 0;

		context.hasFeedingHistory = hasAny;

		if (!hasAny) {
			new AppEmptyState({
				appendTo: this.content,
				icon: '🐄',
				title: 'No feeding records',
				subtitle: 'Feeding logs and schedules are managed from the field panel on the map',
			});
			return;
		}

		// ── Schedules ─────────────────────────────────────────────────────────────
		if (allSchedules.length) {
			new SectionHeader({ appendTo: this.content, textContent: '📅 Schedules' });

			for (const schedule of allSchedules) {
				const fieldName = this._fieldName(schedule.fieldId);
				const supply = schedule.supplyId ? this._supplies?.body?.[schedule.supplyId] : null;

				const card = new Card({
					appendTo: this.content,
					onPointerPress: () =>
						new FeedingScheduleDialog({
							schedule: schedule,
							fieldId: schedule.fieldId,
							onSave: async data => {
								await updateFeedingSchedule(schedule.id, { body: { ...data, _v: schedule._v } });
								this._schedules.body[schedule.id] = { ...schedule, ...data };
								this._renderList();
							},
							onDelete: async () => {
								await deleteFeedingSchedule(schedule.id);
								if (this._schedules?.body) delete this._schedules.body[schedule.id];
								context.hasFeedingHistory =
									Object.keys(this._logs?.body || {}).length > 0 || Object.keys(this._schedules?.body || {}).length > 0;
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
					textContent: `${feedIcon(schedule.feedType)} ${schedule.feedType || 'Feed'}`,
				});

				if (schedule.frequency) {
					new Elem({
						tag: 'span',
						appendTo: titleRow,
						style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', flexShrink: '0', marginLeft: '8px' },
						textContent: frequencyLabel(schedule.frequency),
					});
				}

				const meta = new Elem({ tag: 'div', appendTo: card, addClass: 'card-meta' });

				new Elem({
					tag: 'span',
					appendTo: meta,
					style: {
						color: fieldName ? 'var(--color-medium)' : 'rgba(255,255,255,0.25)',
						fontStyle: fieldName ? '' : 'italic',
					},
					textContent: `📋 ${fieldName || 'Deleted field'}`,
				});

				if (schedule.amountPerHead)
					new Elem({
						tag: 'span',
						appendTo: meta,
						textContent: `${schedule.amountPerHead} ${schedule.amountUnit || 'lbs/hd'}`,
					});
				if (supply) new Elem({ tag: 'span', appendTo: meta, textContent: `📦 ${supply.name}` });
			}
		}

		// ── Feed logs grouped by year ──────────────────────────────────────────────
		if (allLogs.length) {
			new SectionHeader({ appendTo: this.content, textContent: '📋 Feed Log' });

			const byYear = new Map();

			for (const log of allLogs) {
				const year = log.date ? new Date(log.date).getFullYear() : 'Unknown';

				if (!byYear.has(year)) byYear.set(year, []);
				byYear.get(year).push(log);
			}

			for (const [year, logs] of byYear) {
				new Elem({
					tag: 'div',
					appendTo: this.content,
					style: {
						fontSize: '11px',
						textTransform: 'uppercase',
						letterSpacing: '.06em',
						color: 'rgba(255,255,255,0.25)',
						padding: '10px 0 4px',
					},
					textContent: String(year),
				});

				for (const log of logs) {
					const fieldName = this._fieldName(log.fieldId);

					const row = new Component({
						appendTo: this.content,
						style: {
							display: 'flex',
							gap: '8px',
							fontSize: '12px',
							padding: '5px 0',
							borderBottom: '1px solid rgba(255,255,255,0.05)',
							alignItems: 'center',
						},
					});

					new Elem({
						tag: 'span',
						appendTo: row,
						style: { flexShrink: '0', fontSize: '14px' },
						textContent: log.type === 'treat' ? '🍬' : feedIcon(log.feedType),
					});

					const info = new Component({ appendTo: row, style: { flex: '1', minWidth: '0' } });

					new Elem({
						tag: 'div',
						appendTo: info,
						style: { color: '#fff' },
						textContent: `${log.feedType || 'Feed'}${log.amountPerHead ? ` · ${log.amountPerHead} ${log.amountUnit || ''}` : ''}${log.headCount ? ` · ${log.headCount} hd` : ''}`,
					});

					new Elem({
						tag: 'div',
						appendTo: info,
						style: {
							fontSize: '11px',
							color: fieldName ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)',
							fontStyle: fieldName ? '' : 'italic',
						},
						textContent: `📋 ${fieldName || 'Deleted field'} · ${formatDate(log.date)}`,
					});

					const delBtn = new Button({
						appendTo: row,
						textContent: '×',
						attributes: { title: 'Delete this log entry' },
						style: {
							background: 'none',
							border: 'none',
							color: 'rgba(255,255,255,0.2)',
							fontSize: '16px',
							cursor: 'pointer',
							padding: '0 4px',
							flexShrink: '0',
							lineHeight: '1',
						},
						onPointerPress: async e => {
							e.stopPropagation();
							await deleteFeedingLog(log.id);
							if (this._logs?.body) delete this._logs.body[log.id];
							context.hasFeedingHistory =
								Object.keys(this._logs?.body || {}).length > 0 || Object.keys(this._schedules?.body || {}).length > 0;
							this._renderList();
						},
					});
					delBtn.elem.addEventListener('pointerenter', () => {
						delBtn.elem.style.color = '#e05252';
					});
					delBtn.elem.addEventListener('pointerleave', () => {
						delBtn.elem.style.color = 'rgba(255,255,255,0.2)';
					});
				}
			}
		}
	}
}
