import { Elem, FormDialog, Notify, Select, theme } from '@vanilla-bean/components';

import { createBreedingRecord, updateBreedingRecord, deleteBreedingRecord } from '../api/animals';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';
import { keepOpenIfFailed } from '../utils/keepOpenIfFailed';
import { toDateOnly } from '../utils/dates';
import { animalLabel, speciesMeta } from './constants';

const { colors } = theme;

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

export default class BreedingDialog extends FormDialog {
	constructor(options = {}) {
		const isNew = !options.record;
		const rec = options.record || {};
		const dam = options.dam; // animal object for the dam
		const gestation = speciesMeta(dam?.species)?.gestation;

		super({
			size: 'large',
			header: isNew ? `Add Breeding Record — ${animalLabel(dam)}` : 'Edit Breeding Record',
			data: {
				breedingDate: rec.breedingDate || toDateOnly(),
				expectedDueDate: rec.expectedDueDate || '',
				sire: rec.sire || '',
				status: rec.status || 'pending',
				actualBirthDate: rec.actualBirthDate || '',
				litterSize: rec.litterSize || '',
				offspringSurvived: rec.offspringSurvived || '',
				notes: rec.notes || '',
			},
			inputs: [
				// Row 1 — breeding date (due date display added separately below)
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
					inputs: [
						{
							key: 'breedingDate',
							label: 'Breeding date *',
							type: 'date',
							validate: v => (String(v ?? '').trim() ? null : 'Breeding date is required'),
						},
						{
							key: 'expectedDueDate',
							label: 'Override due date (leave blank to auto-compute)',
							type: 'date',
							placeholder: 'Auto-computed from species gestation',
						},
					],
				},
				// Full width — sire
				{ key: 'sire', label: 'Sire (tag ID or external name)', placeholder: 'e.g. Bull #42, Leased from Jones' },
				// Full width — status
				{
					key: 'status',
					label: 'Status',
					InputComponent: Select,
					options: [
						{ value: 'pending', label: 'Pending (not confirmed)' },
						{ value: 'confirmed', label: 'Confirmed pregnant' },
						{ value: 'delivered', label: 'Delivered' },
						{ value: 'failed', label: 'Failed / aborted' },
					],
				},
				// Birth outcome fields — conditional on status === 'delivered'
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' },
					inputs: [
						{
							key: 'actualBirthDate',
							label: 'Actual birth date',
							type: 'date',
							condition: data => data.status === 'delivered',
						},
						{
							key: 'litterSize',
							label: 'Litter size',
							type: 'number',
							min: '0',
							placeholder: '1',
							condition: data => data.status === 'delivered',
						},
						{
							key: 'offspringSurvived',
							label: 'Survived',
							type: 'number',
							min: '0',
							placeholder: '1',
							condition: data => data.status === 'delivered',
						},
					],
				},
				// Full width — notes
				{ key: 'notes', label: 'Notes', placeholder: 'Birth weight, complications, etc.' },
			],
			onSave: () => this._save(rec.id, isNew, options),
			...(!isNew && {
				confirmDelete: { header: `Delete this breeding record for ${animalLabel(dam)}?` },
				onDelete: async () => {
					try {
						if (keepOpenIfFailed(await deleteBreedingRecord(rec.id), 'Delete') === false) return false;

						options.onDelete?.();
					} catch (err) {
						new Notify({ type: 'error', textContent: err.message || 'Delete failed', timeout: 4000 });

						return false;
					}
				},
			}),
			...withoutCallbacks(options),
		});

		if (!isNew) {
			this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'breeding-records', rec.id));
		}

		// Auto-computed due date display — reactive to breedingDate + expectedDueDate changes
		const dueDisplay = new Elem({
			tag: 'div',
			appendTo: this.body,
			style: { fontSize: '12px', color: colors.light(colors.success), padding: '2px 0 6px' },
		});

		if (gestation) {
			const updateDue = () => {
				const dateVal = this.form.options.data.breedingDate;
				const override = this.form.options.data.expectedDueDate;
				if (override) {
					dueDisplay.options.textContent = '';
					return;
				}
				if (dateVal) {
					const d = new Date(`${dateVal}T12:00:00`);
					d.setDate(d.getDate() + gestation);
					const computed = toDateOnly(d);
					dueDisplay.options.textContent = `Auto-computed: ${computed}`;
				} else {
					dueDisplay.options.textContent = '';
				}
			};
			this.form.options.data.addEventListener('set', updateDue);
			updateDue();
		}
	}

	async _save(id, isNew, options) {
		const data = Object.fromEntries(
			Object.keys(this.form.inputElements).map(k => [k, this.form.inputElements[k].options.value]),
		);
		data.damId = options.dam?.id || options.damId;

		try {
			const fn = isNew ? createBreedingRecord : body => updateBreedingRecord(id, body);
			const result = await fn({ body: data });

			if (keepOpenIfFailed(result) === false) return false;

			options.onSave?.(result?.body);
		} catch (err) {
			new Notify({ type: 'error', textContent: err.message || 'Save failed', timeout: 4000 });

			return false;
		}
	}
}
