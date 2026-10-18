import { FormDialog, Select, Elem, Notify } from '@vanilla-bean/components';

import { createBreedingRecord, updateBreedingRecord, deleteBreedingRecord } from '../api/animals';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';
import { animalLabel, speciesMeta } from './constants';

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
				breedingDate: rec.breedingDate || new Date().toISOString().slice(0, 10),
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
						{ key: 'breedingDate', label: 'Breeding date *', type: 'date' },
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
			// Required fields are checked in _save, which keeps the dialog open (false) when one is missing
			onSave: () => this._save(rec.id, isNew, options),
			...(!isNew && {
				confirmDelete: { header: `Delete this breeding record for ${animalLabel(dam)}?` },
				onDelete: async () => {
					try {
						await deleteBreedingRecord(rec.id);
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
			style: { fontSize: '12px', color: '#4caf50', padding: '2px 0 6px' },
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
					const computed = d.toISOString().slice(0, 10);
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

		if (!data.breedingDate) {
			new Notify({ type: 'warning', textContent: 'Breeding date is required', timeout: 3000 });
			return false;
		}

		try {
			const fn = isNew ? createBreedingRecord : body => updateBreedingRecord(id, body);
			const result = await fn({ body: data });
			options.onSave?.(result?.body);
		} catch (err) {
			new Notify({ type: 'error', textContent: err.message || 'Save failed', timeout: 4000 });

			return false;
		}
	}
}
