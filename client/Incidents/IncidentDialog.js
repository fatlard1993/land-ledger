import { FormDialog, Elem, conditionalList, Select } from '@vanilla-bean/components';
import { makePropertiesEditor } from '../utils/PropertiesEditor';
import { toNum } from '../utils/format.js';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';
import { keepOpenIfFailed } from '../utils/keepOpenIfFailed';

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

export const SEVERITY_LEVELS = [
	{ value: 'minor', label: 'Minor', color: '#e8c42a' },
	{ value: 'moderate', label: 'Moderate', color: '#e8932a' },
	{ value: 'major', label: 'Major', color: '#e05252' },
	{ value: 'total_loss', label: 'Total Loss', color: '#c62828' },
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

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

export default class IncidentDialog extends FormDialog {
	constructor(options = {}) {
		const isEdit = !!options.incident?.id;
		const incident = options.incident || {};
		const entityLabel = options.entityName || options.entity?.name || '';

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
								.filter(r => r.lostEl.elem.value || r.injuredEl.elem.value)
								.map(r => ({
									eventId: r.eventId,
									species: r.species,
									lost: r.lostEl.elem.value ? Number(r.lostEl.elem.value) : 0,
									injured: r.injuredEl.elem.value ? Number(r.injuredEl.elem.value) : 0,
								})),
						)
					: null,
				resolved,
				properties: collectProps(),
				// entity status changes — only for equipment/buildings
				entityStatusUpdate: (() => {
					if (button === 'Mark Resolved') return restoreEl?.elem.checked ? 'active' : null;
					return statusImpactSelect?.elem.value || null;
				})(),
			};
		};

		super({
			size: 'large',
			header: isEdit ? `Edit Incident Report` : `Report Incident${entityLabel ? ` — ${entityLabel}` : ''}`,
			buttons: conditionalList([
				{ alwaysItem: 'Save' },
				{ if: isEdit && !incident.resolved, thenItem: 'Mark Resolved' },
				{ if: isEdit, thenItem: 'Delete' },
				{ alwaysItem: 'Cancel' },
			]),
			data: {
				date: incident.date || new Date().toISOString().slice(0, 10),
				severity: incident.severity || 'minor',
				type: incident.type || '',
				description: incident.description || '',
				estimatedLoss: incident.estimatedLoss != null ? incident.estimatedLoss : '',
				insuranceClaim: incident.insuranceClaim || '',
				resolved: !!incident.resolved,
			},
			inputs: [
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
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
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
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
			],
			onSave: async d => {
				return keepOpenIfFailed(await options.onSave?.(payloadFor(d, 'Save')));
			},
			...(isEdit && {
				onDelete: async () => keepOpenIfFailed(await options.onDelete?.(), 'Delete'),
				confirmDelete: { header: `Delete this ${incident.type || 'incident'} report?` },
			}),
			// Mark Resolved is a button of this dialog's own; FormDialog passes it through
			onButtonPress: async ({ button, closeDialog }) => {
				if (button !== 'Mark Resolved') return;

				const result = await options.onSave?.(payloadFor({ ...this.form.options.data }, 'Mark Resolved'));

				if (keepOpenIfFailed(result, 'Mark Resolved') !== false) closeDialog();
			},
			...withoutCallbacks(options),
		});

		// Main form fields

		if (isEdit) this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'incidents', incident.id));

		// Livestock loss — only shown when the field has active livestock
		const liveEvents = options.livestockEvents || [];
		const lossRows = []; // { eventId, species, lostEl, injuredEl }

		if (liveEvents.length > 0) {
			const lossDiv = new Elem({
				tag: 'div',
				appendTo: this.body,
				style: { borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '14px', paddingTop: '10px' },
			});

			new Elem({
				tag: 'div',
				appendTo: lossDiv,
				textContent: '🐄 Stock Loss',
				style: {
					fontSize: '11px',
					textTransform: 'uppercase',
					letterSpacing: '.06em',
					color: 'rgba(255,255,255,0.35)',
					marginBottom: '8px',
				},
			});

			// Parse existing losses keyed by eventId for pre-fill on edit
			const existingLosses = {};

			try {
				let parsed;
				if (!incident.livestockLosses) {
					parsed = [];
				} else if (typeof incident.livestockLosses === 'string') {
					parsed = JSON.parse(incident.livestockLosses);
				} else {
					parsed = incident.livestockLosses;
				}

				for (const l of Array.isArray(parsed) ? parsed : []) existingLosses[l.eventId] = l;
			} catch {}

			for (const event of liveEvents) {
				let details = {};

				try {
					details =
						event.details && typeof event.details === 'string' ? JSON.parse(event.details) : event.details || {};
				} catch {}

				const species = details.species || event.name || 'Stock';
				const headCount = Number(details.headCount) || 0;
				const existing = existingLosses[event.id] || {};

				const eventRow = new Elem({
					tag: 'div',
					appendTo: lossDiv,
					style: {
						display: 'grid',
						gridTemplateColumns: '1fr 80px 80px',
						gap: '8px',
						alignItems: 'center',
						marginBottom: '6px',
					},
				});

				new Elem({
					tag: 'div',
					appendTo: eventRow,
					textContent: `${species}${headCount ? ` (${headCount} hd)` : ''}`,
					style: { fontSize: '13px', color: 'rgba(255,255,255,0.75)' },
				});

				const lostInput = new Elem({
					tag: 'input',
					appendTo: eventRow,
					type: 'number',
					step: '1',
					min: '0',
					placeholder: 'Lost',
					value: existing.lost || '',
					title: 'Head lost / killed',
					style: { textAlign: 'center', fontSize: '13px' },
				});
				const injuredInput = new Elem({
					tag: 'input',
					appendTo: eventRow,
					type: 'number',
					step: '1',
					min: '0',
					placeholder: 'Injured',
					value: existing.injured || '',
					title: 'Head injured / sick',
					style: { textAlign: 'center', fontSize: '13px' },
				});

				lossRows.push({ eventId: event.id, species, lostEl: lostInput, injuredEl: injuredInput });
			}

			// Column headers — inserted before the first eventRow (index 1, after lossHeader)
			const colHeader = new Elem({
				tag: 'div',
				style: {
					display: 'grid',
					gridTemplateColumns: '1fr 80px 80px',
					gap: '8px',
					fontSize: '10px',
					color: 'rgba(255,255,255,0.25)',
					textTransform: 'uppercase',
					letterSpacing: '.04em',
					marginBottom: '2px',
				},
			});

			colHeader.elem.innerHTML =
				'<span></span><span style="text-align:center">Lost</span><span style="text-align:center">Injured</span>';
			lossDiv.elem.insertBefore(colHeader.elem, lossDiv.elem.children[1]);
		}

		// Properties editor
		const { collect: collectProps } = makePropertiesEditor(this.body, {
			...(incident.properties || {}),
			'resolution notes': incident.resolutionNotes || '',
		});

		// Entity status impact — only relevant for equipment and buildings
		const entityType = options.entityType || incident.entityType || '';
		let statusImpactSelect = null;
		let restoreEl = null;

		if (entityType === 'equipment' || entityType === 'building') {
			const divider = new Elem({
				tag: 'div',
				appendTo: this.body,
				style: { borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '14px', paddingTop: '12px' },
			});

			if (!isEdit) {
				new Elem({
					tag: 'label',
					appendTo: divider,
					textContent: 'Entity Status After This Incident',
					style: {
						display: 'block',
						fontSize: '11px',
						textTransform: 'uppercase',
						letterSpacing: '.06em',
						color: 'rgba(255,255,255,0.35)',
						marginBottom: '4px',
					},
				});
				statusImpactSelect = new Elem({ tag: 'select', appendTo: divider });
				[
					{ value: '', label: '— no change —' },
					{ value: 'needs_maintenance', label: '🔩 Needs maintenance' },
					{ value: 'needs_service', label: '🔧 Needs service / attention' },
					{ value: 'out_of_service', label: '⚠️ Out of service' },
					{ value: 'destroyed', label: '☠️ Destroyed / total loss' },
				].forEach(({ value, label }) => {
					const o = document.createElement('option');

					o.value = value;
					o.textContent = label;
					statusImpactSelect.elem.append(o);
				});
			} else if (isEdit && !incident.resolved) {
				// On "Mark Resolved" — offer to restore to service
				const restoreRow = new Elem({
					tag: 'div',
					appendTo: divider,
					style: { display: 'flex', alignItems: 'center', gap: '8px' },
				});

				restoreEl = new Elem({ tag: 'input', appendTo: restoreRow });
				restoreEl.elem.type = 'checkbox';
				restoreEl.elem.id = 'inc-restore-cb';
				restoreEl.elem.checked = false;
				restoreEl.elem.style.accentColor = '#4caf50';

				new Elem({
					tag: 'label',
					appendTo: restoreRow,
					textContent: `Restore ${entityType} to active service`,
					style: { fontSize: '13px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' },
					attributes: { for: 'inc-restore-cb' },
				});
			}
		}
	}
}
