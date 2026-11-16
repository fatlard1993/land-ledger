import { conditionalList, FormDialog, Select, theme } from '@vanilla-bean/components';

import { checkboxField, numberField, PropertiesField } from '../utils/formFields';
import { toNum } from '../utils/format.js';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';
import { stayOpenFor } from '../utils/stayOpenFor';
import { toDateOnly } from '../utils/dates';

export const INCIDENT_TYPES = [
	'Crop Damage — Hail',
	'Crop Damage — Flood',
	'Crop Damage — Wind',
	'Crop Damage — Drought',
	'Crop Damage — Freeze',
	'Crop Damage — Fire',
	'Chemical Drift / Spray Damage',
	'Livestock Injury',
	'Livestock Death',
	'Livestock Disease Outbreak',
	'Livestock Theft',
	'Equipment Breakdown',
	'Equipment Collision',
	'Equipment Fire',
	'Equipment Theft',
	'Building Damage — Fire',
	'Building Damage — Wind',
	'Building Damage — Structural',
	'Building Theft / Vandalism',
	'Worker Injury',
	'Visitor Injury',
	'Environmental Spill',
	'Runoff / Erosion Incident',
	'Other',
];

const { colors, space } = theme;

// Hex, so a reader can append an alpha pair (`${color}22`); light enough to read as text on the dark ground
export const SEVERITY_LEVELS = [
	{ value: 'minor', label: 'Minor', color: colors.light(colors.warning).toHexString() },
	{ value: 'moderate', label: 'Moderate', color: colors.light(colors.orange).toHexString() },
	{ value: 'major', label: 'Major', color: colors.light(colors.danger).toHexString() },
	{ value: 'total_loss', label: 'Total Loss', color: colors.danger.toHexString() },
];

export const severityMeta = v => SEVERITY_LEVELS.find(s => s.value === v) || SEVERITY_LEVELS[0];

export const incidentEmoji = type => {
	if (!type) return '⚠️';
	if (/hail/i.test(type)) return '🌨️';
	if (/flood|water/i.test(type)) return '🌊';
	if (/wind/i.test(type)) return '🌪️';
	if (/fire/i.test(type)) return '🔥';
	if (/freeze|frost/i.test(type)) return '🥶';
	if (/drought/i.test(type)) return '☀️';
	if (/chemical|spray|spill|runoff/i.test(type)) return '🧪';
	if (/theft/i.test(type)) return '🚨';
	if (/injury|worker|visitor/i.test(type)) return '🚑';
	if (/death|disease/i.test(type)) return '💀';
	if (/breakdown|collision/i.test(type)) return '🔧';
	if (/building|structural/i.test(type)) return '🏚️';
	return '⚠️';
};

const STATUS_IMPACTS = [
	{ value: '', label: '— no change —' },
	{ value: 'needs_maintenance', label: 'Needs maintenance' },
	{ value: 'needs_service', label: 'Needs service / attention' },
	{ value: 'out_of_service', label: 'Out of service' },
	{ value: 'destroyed', label: 'Destroyed / total loss' },
];

const LOSS_FIELD = { placeholder: '0', ...numberField({ step: '1', min: '0' }) };

const parsed = value => {
	try {
		return (typeof value === 'string' ? JSON.parse(value) : value) || {};
	} catch {
		return {};
	}
};

/**
 * Each herd on the field, as a row of head lost and injured, filled in from the losses an edited report saved
 * @param {Array<object>} events - The field's livestock events
 * @param {string|Array} savedLosses - The report's livestockLosses
 * @returns {Array<object>} A row per herd: its event, species, label, field keys and saved counts
 */
const lossRowsFor = (events, savedLosses) => {
	const list = parsed(savedLosses);
	const saved = Object.fromEntries((Array.isArray(list) ? list : []).map(l => [l.eventId, l]));

	return events.map(event => {
		const details = parsed(event.details);
		const species = details.species || event.name || 'Stock';
		const headCount = Number(details.headCount) || 0;
		const existing = saved[event.id] || {};

		return {
			eventId: event.id,
			species,
			name: `${species}${headCount ? ` (${headCount} hd)` : ''}`,
			lostKey: `lost_${event.id}`,
			injuredKey: `injured_${event.id}`,
			lost: existing.lost || '',
			injured: existing.injured || '',
		};
	});
};

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

export default class IncidentDialog extends FormDialog {
	constructor(options = {}) {
		const isEdit = !!options.incident?.id;
		const incident = options.incident || {};
		const entityLabel = options.entityName || options.entity?.name || '';
		const entityType = options.entityType || incident.entityType || '';
		// The entity's status after the incident is asked of a new report; an open one offers to restore it
		const asksStatus = (entityType === 'equipment' || entityType === 'building') && !isEdit;
		const offersRestore = (entityType === 'equipment' || entityType === 'building') && isEdit && !incident.resolved;

		// Head lost and injured, for each herd on the field: only shown when the field has active livestock
		const lossRows = lossRowsFor(options.livestockEvents || [], incident.livestockLosses);

		// Save and Mark Resolved send the same record; Mark Resolved marks it resolved and may restore the entity
		const payloadFor = (d, button) => {
			const resolved = button === 'Mark Resolved' ? true : !!d.resolved;

			return {
				date: d.date,
				type: d.type,
				severity: d.severity,
				entityType: options.entityType || incident.entityType || '',
				entityId: options.entity?.id || incident.entityId || '',
				entityName: options.entityName || options.entity?.name || incident.entityName || '',
				description: d.description,
				estimatedLoss: toNum(d.estimatedLoss),
				insuranceClaim: d.insuranceClaim,
				livestockLosses: lossRows.length
					? JSON.stringify(
							lossRows
								.filter(r => toNum(d[r.lostKey]) != null || toNum(d[r.injuredKey]) != null)
								.map(r => ({
									eventId: r.eventId,
									species: r.species,
									lost: toNum(d[r.lostKey]) ?? 0,
									injured: toNum(d[r.injuredKey]) ?? 0,
								})),
						)
					: null,
				resolved,
				properties: d.props,
				// entity status changes — only for equipment/buildings
				entityStatusUpdate: (() => {
					if (button === 'Mark Resolved') return offersRestore && d.restore ? 'active' : null;
					return (asksStatus && d.statusImpact) || null;
				})(),
			};
		};

		super({
			header: isEdit ? `Edit Incident Report` : `Report Incident${entityLabel ? ` — ${entityLabel}` : ''}`,
			// FormDialog acts on the buttons marked with its data-action; Mark Resolved is this dialog's own. The way out
			// comes before the actions and Save is last, as in every dialog
			buttons: conditionalList([
				{ if: isEdit, thenItem: { textContent: 'Delete', 'data-action': 'delete' } },
				{ alwaysItem: { textContent: 'Cancel', 'data-action': 'cancel' } },
				{ if: isEdit && !incident.resolved, thenItem: 'Mark Resolved' },
				{ alwaysItem: { textContent: 'Save', 'data-action': 'save' } },
			]),
			data: {
				date: incident.date || toDateOnly(),
				severity: incident.severity || 'minor',
				type: incident.type || '',
				description: incident.description || '',
				estimatedLoss: incident.estimatedLoss != null ? incident.estimatedLoss : '',
				insuranceClaim: incident.insuranceClaim || '',
				resolved: !!incident.resolved,
				...Object.fromEntries(
					lossRows.flatMap(r => [
						[r.lostKey, r.lost],
						[r.injuredKey, r.injured],
					]),
				),
				props: { ...(incident.properties || {}), 'resolution notes': incident.resolutionNotes || '' },
				statusImpact: '',
				restore: false,
			},
			inputs: [
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space.sm },
					inputs: [
						{ key: 'date', label: 'Date', type: 'date' },
						{
							key: 'severity',
							label: 'Severity',
							InputComponent: Select,
							options: SEVERITY_LEVELS.map(({ value, label }) => ({ value, label })),
						},
					],
				},
				{
					key: 'type',
					label: 'Type',
					placeholder: 'e.g. Hail Damage, Equipment Breakdown, Livestock Death',
					suggestions: INCIDENT_TYPES,
				},
				{
					key: 'description',
					label: 'Description',
					tag: 'textarea',
					rows: 3,
					placeholder: 'What happened, where, estimated extent…',
				},
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space.sm },
					inputs: [
						{
							key: 'estimatedLoss',
							label: 'Estimated Loss ($)',
							type: 'number',
							step: '0.01',
							placeholder: 'Optional',
						},
						{ key: 'insuranceClaim', label: 'Insurance Claim #', placeholder: 'Optional' },
					],
				},
				{ key: 'resolved', label: 'Incident resolved / closed', type: 'checkbox' },
				...lossRows.map(r => ({
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space.sm },
					inputs: [
						{ key: r.lostKey, label: `${r.name}: lost`, title: 'Head lost / killed', ...LOSS_FIELD },
						{ key: r.injuredKey, label: `${r.name}: injured`, title: 'Head injured / sick', ...LOSS_FIELD },
					],
				})),
				{ key: 'props', label: 'Properties', InputComponent: PropertiesField },
				...(asksStatus
					? [
							{
								key: 'statusImpact',
								label: 'Entity Status After This Incident',
								InputComponent: Select,
								options: STATUS_IMPACTS,
							},
						]
					: []),
				...(offersRestore ? [checkboxField('restore', `Restore ${entityType} to active service`)] : []),
			],
			onSave: async d => {
				return stayOpenFor(await options.onSave?.(payloadFor(d, 'Save')));
			},
			...(isEdit && {
				onDelete: async () => stayOpenFor(await options.onDelete?.()),
				confirmDelete: { header: `Delete this ${incident.type || 'incident'} report?` },
			}),
			// Mark Resolved is a button of this dialog's own; it saves through save(action), so it takes Save's checks, busy
			// state, failure line and close
			onButtonPress: ({ button }) => {
				if (button !== 'Mark Resolved') return;

				this.save(async d => stayOpenFor(await options.onSave?.(payloadFor(d, 'Mark Resolved'))));
			},
			...withoutCallbacks(options),
		});

		if (isEdit) this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'incidents', incident.id));
	}
}
