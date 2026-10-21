import {
	Button,
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
import { PageView, RecordCard } from '../Layout';
import FeedingScheduleDialog, { frequencyLabel } from '../Livestock/FeedingScheduleDialog';

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

const Frequency = styled(
	Component,
	({ colors }) => `
		flex-shrink: 0;
		font-size: 11px;
		color: ${colors.gray};
	`,
	{ tag: 'span' },
);

// One feeding in the log: what was fed, where and when, and a way to strike it
const LogRow = styled(
	Component,
	({ colors }) => `
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 0;
		border-bottom: 1px solid ${colors.border};
		font-size: 12px;

		& .icon-cell {
			flex-shrink: 0;
			font-size: 14px;
		}

		& .info {
			flex: 1;
			min-width: 0;
		}

		& .where {
			font-size: 11px;
			color: ${colors.gray};
		}
	`,
);

const DeleteButton = styled(
	Button,
	({ colors }) => `
		flex-shrink: 0;
		color: ${colors.gray};

		&:hover {
			color: ${colors.light(colors.danger)};
		}
	`,
);

const missing = { color: colors.gray, fontStyle: 'italic' };

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
		this.toolbar = new Toolbar({ appendTo: this, variant: 'bar', heading: 'Feeding Records', gap: 8, wrap: false });

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
			new EmptyState({
				appendTo: this.content,
				icon: 'cow',
				title: 'No feeding records',
				message: 'Feeding logs and schedules are managed from the field panel on the map',
			});
			return;
		}

		// ── Schedules ─────────────────────────────────────────────────────────────
		if (allSchedules.length) {
			new SectionLabel({ appendTo: this.content, textContent: 'Schedules' });

			for (const schedule of allSchedules) {
				const fieldName = this._fieldName(schedule.fieldId);
				const supply = schedule.supplyId ? this._supplies?.body?.[schedule.supplyId] : null;

				const card = new RecordCard({
					appendTo: this.content,
					onPointerPress: () =>
						new FeedingScheduleDialog({
							schedule: schedule,
							fieldId: schedule.fieldId,
							onSave: async data => {
								const result = await updateFeedingSchedule(schedule.id, { body: { ...data, _v: schedule._v } });

								if (result?.status === 'error') return result;

								this._schedules.body[schedule.id] = { ...schedule, ...data };
								this._renderList();
							},
							onDelete: async () => {
								const result = await deleteFeedingSchedule(schedule.id);

								if (result?.status === 'error') return result;

								if (this._schedules?.body) delete this._schedules.body[schedule.id];
								context.hasFeedingHistory =
									Object.keys(this._logs?.body || {}).length > 0 || Object.keys(this._schedules?.body || {}).length > 0;
								this._renderList();
							},
						}),
				});

				const titleRow = new TitleRow({ appendTo: card });

				new Elem({
					tag: 'div',
					appendTo: titleRow,
					addClass: 'card-title',
					textContent: `${feedIcon(schedule.feedType)} ${schedule.feedType || 'Feed'}`,
				});

				if (schedule.frequency) {
					new Frequency({ appendTo: titleRow, textContent: frequencyLabel(schedule.frequency) });
				}

				const meta = new Elem({ tag: 'div', appendTo: card, addClass: 'card-meta' });

				new Elem({
					tag: 'span',
					appendTo: meta,
					style: fieldName ? {} : missing,
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
			new SectionLabel({ appendTo: this.content, textContent: 'Feed Log' });

			const byYear = new Map();

			for (const log of allLogs) {
				const year = log.date ? new Date(log.date).getFullYear() : 'Unknown';

				if (!byYear.has(year)) byYear.set(year, []);
				byYear.get(year).push(log);
			}

			for (const [year, logs] of byYear) {
				new SectionLabel({ appendTo: this.content, level: 4, textContent: String(year) });

				for (const log of logs) {
					const fieldName = this._fieldName(log.fieldId);

					const row = new LogRow({ appendTo: this.content });

					new Elem({
						tag: 'span',
						appendTo: row,
						addClass: 'icon-cell',
						textContent: log.type === 'treat' ? '🍬' : feedIcon(log.feedType),
					});

					const info = new Component({ appendTo: row, addClass: 'info' });

					new Elem({
						tag: 'div',
						appendTo: info,
						textContent: `${log.feedType || 'Feed'}${log.amountPerHead ? ` · ${log.amountPerHead} ${log.amountUnit || ''}` : ''}${log.headCount ? ` · ${log.headCount} hd` : ''}`,
					});

					new Elem({
						tag: 'div',
						appendTo: info,
						addClass: 'where',
						style: fieldName ? {} : { fontStyle: 'italic' },
						textContent: `📋 ${fieldName || 'Deleted field'} · ${formatDate(log.date)}`,
					});

					new DeleteButton({
						appendTo: row,
						variant: 'flat',
						icon: 'xmark',
						attributes: { title: 'Delete this log entry' },
						onPointerPress: async e => {
							e.stopPropagation();
							await deleteFeedingLog(log.id);
							if (this._logs?.body) delete this._logs.body[log.id];
							context.hasFeedingHistory =
								Object.keys(this._logs?.body || {}).length > 0 || Object.keys(this._schedules?.body || {}).length > 0;
							this._renderList();
						},
					});
				}
			}
		}
	}
}
