import { Dialog, Form, Select, Notify } from '@vanilla-bean/components';

import { getFields } from '../api';
import { createAnimal, updateAnimal, deleteAnimal } from '../api/animals';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';
import { SPECIES } from './constants';

export default class AnimalDialog extends Dialog {
	constructor(options = {}) {
		const isNew = !options.animal;
		const rec = options.animal || {};

		super({
			size: 'large',
			header: isNew ? 'Add Animal' : `Edit — ${rec.name || rec.tagId || 'Animal'}`,
			buttons: isNew ? ['Save', 'Cancel'] : ['Save', 'Delete', 'Cancel'],
			onButtonPress: async ({ button }) => {
				if (button === 'Cancel') {
					this.close();
					return;
				}
				if (button === 'Delete') {
					try {
						await deleteAnimal(rec.id);
						options.onDelete?.();
						this.close();
					} catch (err) {
						new Notify({ type: 'error', textContent: err.message || 'Delete failed', timeout: 4000 });
					}
					return;
				}
				await this._save(rec.id, isNew, options);
			},
			...options,
		});

		this._form = new Form({
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
			appendTo: this.body,
		});

		if (!isNew) {
			this._form.addCleanup('conflictWatch', watchFormConflicts(this._form, 'animals', rec.id));
		}

		// Async-populate the field Select after Form is rendered
		getFields()
			.then(d => {
				const fieldSelect = this._form.inputElements.fieldId;
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
			Object.keys(this._form.inputElements).map(k => [k, this._form.inputElements[k].options.value]),
		);

		if (!data.tagId) {
			new Notify({ type: 'warning', textContent: 'Tag / ID is required', timeout: 3000 });
			return;
		}

		try {
			const fn = isNew ? createAnimal : body => updateAnimal(id, body);
			const result = await fn({ body: data });
			options.onSave?.(result?.body);
			this.close();
		} catch (err) {
			new Notify({ type: 'error', textContent: err.message || 'Save failed', timeout: 4000 });
		}
	}
}
