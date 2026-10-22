import { formatDate, theme } from '@vanilla-bean/components';

import { ActionHeader, SquareBadge } from '../Layout';
import { formatDollar } from '../utils/format';
import parseDetails from '../utils/parseDetails';
import { IconText } from '../statusIcons';
import IncidentDialog, { incidentEmoji, severityMeta } from '../Incidents/IncidentDialog';
import {
	getIncidents,
	createIncident,
	updateIncident,
	deleteIncident,
	updateEquipment,
	updateBuilding,
	updateEvent,
} from '../api';
import { EmptyNote, HeaderButton, PanelRow, RowAside, RowGlyph, RowMain, RowMeta, RowTitle } from './panelParts';

const { colors, space } = theme;

export async function renderIncidents(entityType, entity, refresh, appendTo, { livestockEvents = [] } = {}) {
	const data = await getIncidents();
	const records = Object.values(data?.body || {})
		.filter(r => r.entityType === entityType && r.entityId === entity?.id)
		.sort((a, b) => new Date(b.date) - new Date(a.date));

	const header = new ActionHeader({ appendTo, title: 'Incidents' });

	const applyEntityStatus = async status => {
		if (!status || !entity?.id) return;

		if (entityType === 'equipment') await updateEquipment(entity.id, { body: { status, _v: entity._v } });
		else if (entityType === 'building') await updateBuilding(entity.id, { body: { status, _v: entity._v } });
	};

	new HeaderButton({
		appendTo: header,
		icon: 'triangle-exclamation',
		textContent: 'Report',
		style: { marginTop: space.md },
		onPointerPress: () =>
			new IncidentDialog({
				entityType,
				entity,
				livestockEvents,
				onSave: async incData => {
					const result = await createIncident({ body: incData });

					if (result?.status === 'error') return result;

					if (incData.entityStatusUpdate) await applyEntityStatus(incData.entityStatusUpdate);
					await applyLivestockLosses(incData.livestockLosses, livestockEvents);
					refresh();
				},
			}),
	});

	if (!records.length) {
		new EmptyNote({ appendTo, textContent: 'No incidents recorded' });
		return;
	}

	for (const rec of records) {
		const sm = severityMeta(rec.severity);
		const open = !rec.resolved;

		const row = new PanelRow({ appendTo, addClass: 'interactive' });

		new RowGlyph({ appendTo: row, style: { opacity: open ? '1' : '0.4' }, textContent: incidentEmoji(rec.type) });

		const info = new RowMain({ appendTo: row });

		const titleRow = new RowTitle({
			appendTo: info,
			style: { display: 'flex', gap: space.sm, alignItems: 'center', flexWrap: 'wrap' },
		});

		new RowTitle({
			tag: 'span',
			appendTo: titleRow,
			style: {
				color: open ? colors.white : colors.gray,
				fontWeight: '500',
				textDecoration: rec.resolved ? 'line-through' : 'none',
			},
			textContent: rec.type || 'Incident',
		});
		// Tinted by mixing, since a severity's color may come as CSS text or a theme color
		new SquareBadge({
			appendTo: titleRow,
			textContent: sm.label,
			style: {
				color: `${sm.color}`,
				background: `color-mix(in hsl, ${sm.color} 13%, transparent)`,
				border: `1px solid color-mix(in hsl, ${sm.color} 27%, transparent)`,
			},
		});

		const meta = [];

		if (rec.livestockLosses) {
			try {
				const losses = typeof rec.livestockLosses === 'string' ? JSON.parse(rec.livestockLosses) : rec.livestockLosses;

				if (Array.isArray(losses) && losses.length) {
					const parts = losses.map(l => {
						const numbers = [l.lost ? `${l.lost} lost` : null, l.injured ? `${l.injured} injured` : null]
							.filter(Boolean)
							.join(', ');

						return `${l.species}${numbers ? `: ${numbers}` : ''}`;
					});

					meta.push(`🐄 ${parts.join(' · ')}`);
				}
			} catch {}
		}

		if (rec.estimatedLoss) meta.push(`${formatDollar(rec.estimatedLoss)} loss`);
		if (rec.insuranceClaim) meta.push(`Claim: ${rec.insuranceClaim}`);
		if (meta.length || rec.resolved) {
			const metaRow = new RowMeta({ appendTo: info, style: { marginTop: space.xs }, textContent: meta.join(' · ') });

			if (rec.resolved) {
				if (meta.length) metaRow.elem.append(' · ');
				new IconText({ tag: 'span', appendTo: metaRow, icon: 'circle-check', textContent: 'Resolved' });
			}
		}

		new RowAside({ appendTo: row, textContent: formatDate(rec.date) || '—' });

		row.onPointerPress(
			() =>
				new IncidentDialog({
					incident: rec,
					entityType,
					entity,
					livestockEvents,
					onSave: async incData => {
						const result = await updateIncident(rec.id, { body: { ...incData, _v: rec._v } });

						if (result?.status === 'error') return result;

						if (incData.entityStatusUpdate) await applyEntityStatus(incData.entityStatusUpdate);
						await applyLivestockLosses(incData.livestockLosses, livestockEvents, rec.livestockLosses);
						refresh();
					},
					onDelete: async () => {
						const result = await deleteIncident(rec.id);

						if (result?.status === 'error') return result;

						refresh();
					},
				}),
		);
	}
}

export async function applyLivestockLosses(newLossesJson, livestockEvents = [], prevLossesJson = null) {
	if (!newLossesJson && !prevLossesJson) return;

	const parseLosses = s => {
		if (!s) return [];

		try {
			const parsed = typeof s === 'string' ? JSON.parse(s) : s;
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	};

	const newLosses = parseLosses(newLossesJson);
	const prevLosses = parseLosses(prevLossesJson);

	// Build a map of net delta per eventId (new - old)
	const deltas = new Map();

	for (const l of prevLosses) {
		deltas.set(l.eventId, (deltas.get(l.eventId) || 0) - (Number(l.lost) || 0));
	}

	for (const l of newLosses) {
		deltas.set(l.eventId, (deltas.get(l.eventId) || 0) + (Number(l.lost) || 0));
	}

	for (const [eventId, delta] of deltas) {
		if (!delta) continue;

		const event = livestockEvents.find(e => e.id === eventId);

		if (!event) continue;

		const d = parseDetails(event.details);
		const current = Number(d.headCount) || 0;
		const updated = Math.max(0, current - delta);

		if (updated === current) continue;

		const result = await updateEvent(event.id, {
			body: { details: JSON.stringify({ ...d, headCount: updated }), _v: event._v },
		}).catch(() => null);

		// Keep local copy in sync so the panel re-render shows the new count
		if (result?.status === 'success' && result.body && event) {
			event.details = { ...d, headCount: updated };
		}
	}
}
