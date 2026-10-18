import { FormDialog, Select, Notify } from '@vanilla-bean/components';

import { getFields } from '../api';
import { createAnimal, updateAnimal, deleteAnimal } from '../api/animals';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';
import { SPECIES } from './constants';

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

export default class AnimalDialog extends FormDialog {
	constructor(options = {}) {
		const isNew = !options.animal;
		const rec = options.animal || {};

		super({
			size: 'large',
			header: isNew ? 'Add Animal' : `Edit — ${rec.name || rec.tagId || 'Animal'}`,
			data: {
				tagId: rec.tagId || '',
				name: rec.name || '',
				species: rec.species || 'cattle',
				sex: rec.sex || 'female',
				status: rec.status || 'active',
				breed: rec.breed || '',
				birthDate: rec.birthDate || '',
				fieldId: rec.fieldId || '',
				dam: rec.dam || '',
				sire: rec.sire || '',
				notes: rec.notes || '',
			},
			inputs: [
				// Row 1 — tag + name
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
					inputs: [
						{ key: 'tagId', label: 'Tag / ID *', placeholder: 'Ear tag, tattoo, or RFID' },
						{ key: 'name', label: 'Name (optional)', placeholder: 'e.g. Bessie' },
					],
				},
				// Row 2 — species + sex + status
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' },
					inputs: [
						{
							key: 'species',
							label: 'Species *',
							InputComponent: Select,
							options: SPECIES.map(s => ({ value: s.value, label: `${s.icon} ${s.label}` })),
						},
						{
							key: 'sex',
							label: 'Sex',
							InputComponent: Select,
							options: [
								{ value: 'female', label: 'Female' },
								{ value: 'male', label: 'Male' },
								{ value: 'castrated', label: 'Castrated' },
							],
						},
						{
							key: 'status',
							label: 'Status',
							InputComponent: Select,
							options: [
								{ value: 'active', label: '✓ Active' },
								{ value: 'deceased', label: '☠ Deceased' },
								{ value: 'sold', label: '💰 Sold' },
								{ value: 'transferred', label: '→ Transferred' },
							],
						},
					],
				},
				// Full width — breed
				{ key: 'breed', label: 'Breed', placeholder: 'e.g. Angus, Nubian, Hampshire' },
				// Row 3 — birthDate + fieldId
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
					inputs: [
						{ key: 'birthDate', label: 'Date of birth', type: 'date' },
						{
							key: 'fieldId',
							label: 'Current field',
							InputComponent: Select,
							options: [{ label: '— none —', value: '' }],
						},
					],
				},
				// Row 4 — parentage
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
					inputs: [
						{ key: 'dam', label: 'Dam (tag ID or name)', placeholder: 'Optional' },
						{ key: 'sire', label: 'Sire (tag ID or name)', placeholder: 'Optional' },
					],
				},
				// Full width — notes
				{ key: 'notes', label: 'Notes', placeholder: 'Any notes' },
			],
			// Required fields are checked in _save, which keeps the dialog open (false) when one is missing
			onSave: () => this._save(rec.id, isNew, options),
			...(!isNew && {
				confirmDelete: { header: `Delete "${rec.name || rec.tagId || 'this animal'}"?` },
				onDelete: async () => {
					try {
						await deleteAnimal(rec.id);
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
			this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'animals', rec.id));
		}

		// Async-populate the field Select after Form is rendered
		getFields()
			.then(d => {
				const fieldSelect = this.form.inputElements.fieldId;
				const opts = [
					{ label: '— none —', value: '' },
					...Object.values(d?.body || {})
						.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
						.map(f => ({ label: f.name || 'Unnamed', value: f.id })),
				];
				fieldSelect.options.options = opts;
				fieldSelect.options.value = rec.fieldId || '';
			})
			.catch(() => {});
	}

	async _save(id, isNew, options) {
		const data = Object.fromEntries(
			Object.keys(this.form.inputElements).map(k => [k, this.form.inputElements[k].options.value]),
		);

		if (!data.tagId) {
			new Notify({ type: 'warning', textContent: 'Tag / ID is required', timeout: 3000 });
			return false;
		}

		try {
			const fn = isNew ? createAnimal : body => updateAnimal(id, body);
			const result = await fn({ body: data });
			options.onSave?.(result?.body);
		} catch (err) {
			new Notify({ type: 'error', textContent: err.message || 'Save failed', timeout: 4000 });

			return false;
		}
	}
}
