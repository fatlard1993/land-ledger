import { Dialog, Form, Select, Elem, Notify } from '@vanilla-bean/components';

import { createHealthRecord, updateHealthRecord, deleteHealthRecord } from '../api/animals';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';
import { animalLabel } from './constants';

export default class HealthRecordDialog extends Dialog {
	constructor(options = {}) {
		const isNew = !options.record;
		const rec = options.record || {};
		const animal = options.animal;

		super({
			size: 'large',
			header: isNew ? `Add Health Record — ${animalLabel(animal)}` : 'Edit Health Record',
			buttons: isNew ? ['Save', 'Cancel'] : ['Save', 'Delete', 'Cancel'],
			onButtonPress: async ({ button }) => {
				if (button === 'Cancel') {
					this.close();
					return;
				}
				if (button === 'Delete') {
					try {
						await deleteHealthRecord(rec.id);
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
				date: rec.date || new Date().toISOString().slice(0, 10),
				type: rec.type || 'treatment',
				drug: rec.drug || '',
				dose: rec.dose || '',
				route: rec.route || '',
				withdrawalDays: rec.withdrawalDays || '',
				treatedBy: rec.treatedBy || '',
				notes: rec.notes || '',
			},
			inputs: [
				// Row 1 — date + type
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
					inputs: [
						{ key: 'date', label: 'Date *', type: 'date' },
						{
							key: 'type',
							label: 'Type',
							InputComponent: Select,
							options: [
								{ value: 'vaccination', label: 'Vaccination' },
								{ value: 'treatment', label: 'Treatment' },
								{ value: 'observation', label: 'Observation' },
								{ value: 'injury', label: 'Injury' },
							],
						},
					],
				},
				// Full width — drug
				{ key: 'drug', label: 'Drug / vaccine name *', placeholder: 'e.g. Ivermectin, BoviShield' },
				// Row 2 — dose + route
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
					inputs: [
						{ key: 'dose', label: 'Dose', placeholder: 'e.g. 2mL, 5cc' },
						{
							key: 'route',
							label: 'Route',
							InputComponent: Select,
							options: [
								{ value: '', label: '— select —' },
								{ value: 'IM', label: 'IM (intramuscular)' },
								{ value: 'SQ', label: 'SQ (subcutaneous)' },
								{ value: 'oral', label: 'Oral' },
								{ value: 'topical', label: 'Topical' },
								{ value: 'IV', label: 'IV (intravenous)' },
							],
						},
					],
				},
				// Full width — withdrawal days
				{ key: 'withdrawalDays', label: 'Withdrawal (days)', type: 'number', min: 0, placeholder: 'from label' },
				// Full width — treated by
				{ key: 'treatedBy', label: 'Treated by', placeholder: 'Vet name, farm staff' },
				// Full width — notes
				{ key: 'notes', label: 'Notes', placeholder: 'Observations, lot number, etc.' },
			],
			appendTo: this.body,
		});

		// Computed withdrawal date display — reactive to date + withdrawalDays changes
		const withdrawalDisplay = new Elem({
			tag: 'div',
			appendTo: this.body,
			style: { fontSize: '13px', color: '#e8c42a', fontWeight: '600', padding: '4px 0 8px' },
		});

		const updateWithdrawal = () => {
			const dateVal = this._form.options.data.date;
			const days = parseInt(this._form.options.data.withdrawalDays, 10);
			if (dateVal && days > 0) {
				const d = new Date(`${dateVal}T12:00:00`);
				d.setDate(d.getDate() + days);
				withdrawalDisplay.options.textContent = `Withdrawal until: ${d.toISOString().slice(0, 10)}`;
				withdrawalDisplay.options.style = { color: '#e8c42a' };
			} else {
				withdrawalDisplay.options.textContent = '';
			}
		};

		this._form.options.data.addEventListener('set', updateWithdrawal);
		updateWithdrawal();

		if (!isNew) {
			this._form.addCleanup('conflictWatch', watchFormConflicts(this._form, 'health-records', rec.id));
		}
	}

	async _save(id, isNew, options) {
		const data = Object.fromEntries(
			Object.keys(this._form.inputElements).map(k => [k, this._form.inputElements[k].options.value]),
		);
		data.animalId = options.animal?.id || options.animalId;

		if (!data.date) {
			new Notify({ type: 'warning', textContent: 'Date is required', timeout: 3000 });
			return;
		}
		if (!data.drug) {
			new Notify({ type: 'warning', textContent: 'Drug / vaccine name is required', timeout: 3000 });
			return;
		}

		try {
			const fn = isNew ? createHealthRecord : body => updateHealthRecord(id, body);
			const result = await fn({ body: data });
			options.onSave?.(result?.body);
			this.close();
		} catch (err) {
			new Notify({ type: 'error', textContent: err.message || 'Save failed', timeout: 4000 });
		}
	}
}
