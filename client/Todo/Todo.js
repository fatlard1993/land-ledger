import { Button, Component, Elem, formatDate } from '@vanilla-bean/components';

import AsyncView from '../AsyncView';

import { getAnimals, getHealthRecords, getBreedingRecords } from '../api/animals';
import { scheduleStatus } from '../utils/maintenanceUtils';

import {
	getMaintenanceSchedules,
	getEquipment,
	getFeedingSchedules,
	getFeedingLogs,
	getFields,
	getIncidents,
	getEvents,
	getLeases,
	getLoans,
	createFeedingLog,
} from '../api';
import { PageView, PageToolbar, PageTitle, SectionHeader } from '../Layout';
import { frequencyInterval, frequencyLabel } from '../Livestock/FeedingScheduleDialog';
import { incidentEmoji, severityMeta } from '../Incidents/IncidentDialog';
import { categoryMeta, eventEmoji } from '../Timeline/EventDialog';
import context from '../context';

const TODAY = () => new Date();
const daysBetween = (a, b) => (b - a) / 86_400_000;

// ── Urgency tiers ────────────────────────────────────────────────────────────
const NOW = 'now'; // overdue / needs attention immediately
const SOON = 'soon'; // coming up / within a threshold
const LATER = 'later'; // back-burner — needs doing, no deadline pressure

// scheduleStatus imported from utils/maintenanceUtils — returns { status, label } or null.
// Map status → urgency tier for Todo display.
const maintenanceStatus = (schedule, currentUsage, unit = '') => {
	const result = scheduleStatus(schedule, currentUsage, unit, TODAY());
	if (!result || result.status === 'ok') return null;
	return { urgency: result.status === 'overdue' ? NOW : SOON, label: result.label };
};

// ── Feeding schedule status ───────────────────────────────────────────────────
const feedStatus = (schedule, logs) => {
	const interval = frequencyInterval(schedule.frequency);

	if (interval === null) return null; // free-choice / as-needed — never "due"

	const lastLog = [...logs]
		.filter(l => l.scheduleId === schedule.id)
		.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

	if (!lastLog) return { urgency: NOW, label: 'Never recorded', daysSince: null };

	const daysSince = daysBetween(new Date(lastLog.date), TODAY());

	if (daysSince >= interval)
		return {
			urgency: NOW,
			label: `${Math.floor(daysSince)}d since last feeding (${frequencyLabel(schedule.frequency)})`,
			daysSince,
		};
	if (daysSince >= interval * 0.75)
		return {
			urgency: SOON,
			label: `Due in ~${Math.ceil(interval - daysSince)}d (${frequencyLabel(schedule.frequency)})`,
			daysSince,
		};

	return null;
};

// ── Date urgency (leases, renewals) ──────────────────────────────────────────
const dateUrgency = (dateStr, soonThreshold = 30, laterThreshold = 90) => {
	if (!dateStr) return null;
	const days = Math.ceil(daysBetween(TODAY(), new Date(dateStr)));

	if (days < 0) return { urgency: NOW, daysUntil: days };
	if (days <= soonThreshold) return { urgency: SOON, daysUntil: days };
	if (days <= laterThreshold) return { urgency: LATER, daysUntil: days };

	return null;
};

export default class Todo extends AsyncView {
	_buildView() {
		this.toolbar = new PageToolbar({ appendTo: this });
		new PageTitle({ appendTo: this.toolbar, textContent: 'To Do' });

		this.content = new PageView({ appendTo: this });
	}

	_datasources() {
		return {
			_schedules: getMaintenanceSchedules,
			_equipment: getEquipment,
			_feedingSchedules: getFeedingSchedules,
			_feedingLogs: getFeedingLogs,
			_fields: getFields,
			_incidents: getIncidents,
			_leases: getLeases,
			_loans: getLoans,
			_events: getEvents,
			_animals: getAnimals,
			_healthRecords: getHealthRecords,
			_breedingRecords: getBreedingRecords,
		};
	}

	_onData() {
		this._build();
	}

	_build() {
		this.content.empty();

		const todos = this._collectTodos();

		if (!todos.length) {
			const wrap = new Component({ appendTo: this.content, style: { textAlign: 'center', padding: '48px 16px' } });

			new Elem({ tag: 'div', appendTo: wrap, style: { fontSize: '40px', marginBottom: '12px' }, textContent: '✅' });
			new Elem({
				tag: 'div',
				appendTo: wrap,
				style: { fontSize: '16px', color: '#fff', fontWeight: '600' },
				textContent: 'All clear',
			});
			new Elem({
				tag: 'div',
				appendTo: wrap,
				style: { fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginTop: '6px' },
				textContent: 'Nothing overdue or coming up',
			});

			return;
		}

		const tiers = [
			{ key: NOW, label: '🔴 Needs Attention', color: '#e05252' },
			{ key: SOON, label: '🟡 Coming Up', color: '#e8c42a' },
			{ key: LATER, label: '⚪ Back Burner', color: 'rgba(255,255,255,0.4)' },
		];

		for (const { key, label, color } of tiers) {
			const items = todos.filter(t => t.urgency === key);

			if (!items.length) continue;

			new SectionHeader({ appendTo: this.content, textContent: label });

			for (const item of items) this._renderItem(item, color);
		}
	}

	_collectTodos() {
		const todos = [];
		const equipMap = this._equipment?.body || {};
		const fieldMap = this._fields?.body || {};
		const logs = Object.values(this._feedingLogs?.body || {});

		// ── Maintenance schedules ────────────────────────────────────────────────
		for (const schedule of Object.values(this._schedules?.body || {})) {
			const eq = equipMap[schedule.equipmentId];
			const currentUsage = Number(eq?.usage) || 0;
			const status = maintenanceStatus(schedule, currentUsage, eq?.usageUnit || '');

			if (!status) continue;

			todos.push({
				urgency: status.urgency,
				icon: '🔧',
				title: schedule.name || 'Maintenance',
				entity: eq?.name || 'Equipment',
				detail: status.label,
				detail2: schedule.procedure || null,
				navigate: '/Maintenance',
			});
		}

		// ── Equipment status flags ───────────────────────────────────────────────
		for (const eq of Object.values(equipMap)) {
			if (!eq.status) continue;

			const equipUrgencyMap = {
				out_of_service: NOW,
				needs_service: NOW,
				needs_maintenance: SOON,
			};
			const urgency = equipUrgencyMap[eq.status] ?? null;

			if (!urgency) continue;

			const label = {
				out_of_service: 'Out of service',
				needs_service: 'Needs service',
				needs_maintenance: 'Needs maintenance',
			}[eq.status];

			todos.push({
				urgency,
				icon: eq.emoji || '🚜',
				title: label,
				entity: eq.name || 'Equipment',
				detail: eq.type || null,
				navigate: '/',
			});
		}

		// ── Feeding schedules ────────────────────────────────────────────────────
		for (const schedule of Object.values(this._feedingSchedules?.body || {})) {
			const status = feedStatus(schedule, logs);

			if (!status) continue;

			const field = fieldMap[schedule.fieldId];

			todos.push({
				urgency: status.urgency,
				icon: '🐄',
				title: `${schedule.feedType || 'Feeding'} due`,
				entity: field?.name || 'Field',
				detail: status.label,
				quickAction: {
					label: '✓ Fed',
					fn: async () => {
						await createFeedingLog({
							body: {
								scheduleId: schedule.id,
								fieldId: schedule.fieldId,
								feedType: schedule.feedType,
								amountPerHead: schedule.amountPerHead,
								amountUnit: schedule.amountUnit,
								type: 'scheduled',
								date: new Date().toISOString().slice(0, 10),
							},
						});
						this._build();
					},
				},
			});
		}

		// ── Field status flags ───────────────────────────────────────────────────
		for (const field of Object.values(fieldMap)) {
			if (!field.status || field.status === 'fallow') continue;

			let urgency;
			if (field.status === 'needs_maintenance') {
				urgency = SOON;
			} else {
				urgency = LATER;
			}

			const label =
				{
					abandoned: 'Marked abandoned',
					closed: 'Marked closed',
					needs_maintenance: 'Needs maintenance',
				}[field.status] || field.status;

			todos.push({
				urgency,
				icon: '📋',
				title: label,
				entity: field.name || 'Field',
				detail: field.acreage ? `${field.acreage} ${field.acreageUnit || 'ac'}` : null,
				navigate: '/',
			});
		}

		// ── Unresolved incidents ─────────────────────────────────────────────────
		for (const incident of Object.values(this._incidents?.body || {})) {
			if (incident.resolved) continue;

			const severity = severityMeta(incident.severity);
			let urgency;
			if (severity.value === 'total_loss' || severity.value === 'major') {
				urgency = NOW;
			} else if (severity.value === 'moderate') {
				urgency = SOON;
			} else {
				urgency = LATER;
			}

			todos.push({
				urgency,
				icon: incidentEmoji(incident.type),
				title: incident.type || 'Incident',
				entity: incident.entityName || '',
				detail: [severity.label, incident.date ? formatDate(incident.date) : null].filter(Boolean).join(' · '),
				detail2: incident.description || null,
				navigate: '/Incidents',
			});
		}

		// ── Lease renewals ───────────────────────────────────────────────────────
		for (const lease of Object.values(this._leases?.body || {})) {
			const renewal = dateUrgency(lease.renewalDate, 30, 90);

			if (!renewal) continue;

			const dStr =
				renewal.daysUntil < 0
					? `Renewal overdue by ${Math.abs(renewal.daysUntil)} day${Math.abs(renewal.daysUntil) !== 1 ? 's' : ''}`
					: `Renewal in ${renewal.daysUntil} day${renewal.daysUntil !== 1 ? 's' : ''} — ${formatDate(lease.renewalDate)}`;

			todos.push({
				urgency: renewal.urgency,
				icon: '📝',
				title: 'Lease renewal',
				entity: lease.entityName || lease.landlordName || lease.tenantName || '',
				detail: dStr,
				navigate: '/Leases',
			});
		}

		// ── Loan maturities ──────────────────────────────────────────────────────
		for (const loan of Object.values(this._loans?.body || {})) {
			const maturity = dateUrgency(loan.maturityDate, 60, 180);

			if (!maturity) continue;

			const dStr =
				maturity.daysUntil < 0
					? `Matured ${Math.abs(maturity.daysUntil)} day${Math.abs(maturity.daysUntil) !== 1 ? 's' : ''} ago`
					: `Matures in ${maturity.daysUntil} days — ${formatDate(loan.maturityDate)}`;

			todos.push({
				urgency: maturity.urgency,
				icon: '🏦',
				title: 'Loan maturity',
				entity: loan.lender || loan.entityName || '',
				detail: dStr,
				navigate: '/Leases',
			});
		}

		// ── Future planned events ────────────────────────────────────────────────
		const todayStr = new Date().toISOString().slice(0, 10);

		for (const event of Object.values(this._events?.body || {})) {
			if (!event.date || event.date <= todayStr) continue;

			const daysUntil = Math.ceil((new Date(event.date) - new Date()) / 86_400_000);

			let urgency;
			if (daysUntil <= 7) {
				urgency = NOW;
			} else if (daysUntil <= 30) {
				urgency = SOON;
			} else {
				urgency = LATER;
			}

			let dateLabel;
			if (daysUntil === 0) {
				dateLabel = 'Today';
			} else if (daysUntil === 1) {
				dateLabel = 'Tomorrow';
			} else if (daysUntil <= 14) {
				dateLabel = `In ${daysUntil} days — ${formatDate(event.date)}`;
			} else {
				dateLabel = formatDate(event.date);
			}

			const meta = categoryMeta(event.category);
			const field = fieldMap[event.fieldId];

			todos.push({
				urgency,
				icon: eventEmoji(event),
				title: event.name || meta.label,
				entity: field?.name || '',
				detail: dateLabel,
				onPress: () => {
					context.timelineFieldFilter = event.fieldId || null;
					window.location.hash = '/Timeline';
				},
			});
		}

		// ── Withdrawal period compliance ─────────────────────────────────────────
		const animalMap = this._animals?.body || {};
		for (const r of Object.values(this._healthRecords?.body || {})) {
			if (!r.withdrawalDate || r.withdrawalDate < todayStr) continue;
			const animal = animalMap[r.animalId];
			const daysLeft = Math.ceil((new Date(r.withdrawalDate) - new Date()) / 86_400_000);

			let urgency;
			if (daysLeft <= 3) {
				urgency = NOW;
			} else if (daysLeft <= 7) {
				urgency = SOON;
			} else {
				urgency = LATER;
			}

			todos.push({
				urgency,
				icon: '💊',
				title: 'Withdrawal period active',
				entity: animal ? animal.name || `#${animal.tagId}` : 'Animal',
				detail: `${r.drug} — clears ${r.withdrawalDate} (${daysLeft}d)`,
				onPress: () => {
					window.location.hash = '/Animals';
				},
			});
		}

		// ── Upcoming births ───────────────────────────────────────────────────────
		for (const r of Object.values(this._breedingRecords?.body || {})) {
			if (!r.expectedDueDate || r.status === 'delivered' || r.status === 'failed') continue;
			if (r.expectedDueDate < todayStr) continue;

			const dam = animalMap[r.damId];
			const daysUntil = Math.ceil((new Date(r.expectedDueDate) - new Date()) / 86_400_000);

			let urgency;
			if (daysUntil <= 7) {
				urgency = NOW;
			} else if (daysUntil <= 21) {
				urgency = SOON;
			} else {
				urgency = LATER;
			}

			let dateLabel;
			if (daysUntil === 1) {
				dateLabel = 'Tomorrow';
			} else if (daysUntil <= 14) {
				dateLabel = `In ${daysUntil} days — ${formatDate(r.expectedDueDate)}`;
			} else {
				dateLabel = formatDate(r.expectedDueDate);
			}

			todos.push({
				urgency,
				icon: '🐣',
				title: 'Birth expected',
				entity: dam ? dam.name || `#${dam.tagId}` : 'Animal',
				detail: dateLabel,
				onPress: () => {
					window.location.hash = '/Animals';
				},
			});
		}

		// Sort within each tier: feeding > maintenance > incidents
		const typeOrder = { '🐄': 0, '🔧': 1, '⚠️': 2 };
		const urgencyOrder = { [NOW]: 0, [SOON]: 1, [LATER]: 2 };

		return todos.sort(
			(a, b) =>
				urgencyOrder[a.urgency] - urgencyOrder[b.urgency] || (typeOrder[a.icon] ?? 9) - (typeOrder[b.icon] ?? 9),
		);
	}

	_renderItem(item, accentColor) {
		const card = new Component({
			appendTo: this.content,
			style: {
				display: 'flex',
				gap: '10px',
				padding: '10px 0',
				borderBottom: '1px solid rgba(255,255,255,0.06)',
				alignItems: 'flex-start',
				cursor: item.navigate ? 'pointer' : 'default',
			},
		});

		new Elem({
			tag: 'span',
			appendTo: card,
			style: { fontSize: '20px', flexShrink: '0', marginTop: '1px', lineHeight: '1' },
			textContent: item.icon,
		});

		const body = new Component({ appendTo: card, style: { flex: '1', minWidth: '0' } });

		const titleRow = new Component({
			appendTo: body,
			style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' },
		});

		new Elem({
			tag: 'div',
			appendTo: titleRow,
			style: { fontSize: '13px', fontWeight: '600', color: '#fff' },
			textContent: item.title,
		});

		if (item.entity) {
			new Elem({
				tag: 'div',
				appendTo: titleRow,
				style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', flexShrink: '0' },
				textContent: item.entity,
			});
		}

		if (item.detail) {
			new Elem({
				tag: 'div',
				appendTo: body,
				style: { fontSize: '12px', color: accentColor, marginTop: '2px' },
				textContent: item.detail,
			});
		}

		if (item.detail2) {
			new Elem({
				tag: 'div',
				appendTo: body,
				style: {
					fontSize: '11px',
					color: 'rgba(255,255,255,0.35)',
					marginTop: '2px',
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap',
				},
				textContent: item.detail2,
			});
		}

		if (item.quickAction) {
			new Button({
				appendTo: card,
				textContent: item.quickAction.label,
				style: {
					fontSize: '12px',
					padding: '4px 10px',
					flexShrink: '0',
					background: 'rgba(76,175,80,0.15)',
					border: '1px solid rgba(76,175,80,0.4)',
					color: '#4caf50',
				},
				onPointerPress: async e => {
					e.stopPropagation?.();
					await item.quickAction.fn();
				},
			});
		}

		if (item.onPress) {
			card.onPointerPress(item.onPress);
		} else if (item.navigate) {
			card.onPointerPress(() => {
				window.location.hash = item.navigate === '/' ? '' : item.navigate;
			});
		}
	}
}
