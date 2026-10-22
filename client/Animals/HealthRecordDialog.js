import { Elem, FormDialog, Notify, parseDate, Select, theme } from '@vanilla-bean/components';

import { createHealthRecord, updateHealthRecord, deleteHealthRecord } from '../api/animals';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';
import { keepOpenIfFailed } from '../utils/keepOpenIfFailed';
import { toDateOnly } from '../utils/dates';
import { animalLabel } from './constants';

const { colors } = theme;

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

export default class HealthRecordDialog extends FormDialog {
	constructor(options = {}) {
		const isNew = !options.record;
		const rec = options.record || {};
		const animal = options.animal;

		super({
			size: 'large',
			header: isNew ? `Add Health Record — ${animalLabel(animal)}` : 'Edit Health Record',
			data: {
				date: rec.date || toDateOnly(),
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
						{
							key: 'date',
							label: 'Date *',
							type: 'date',
							validate: v => (String(v ?? '').trim() ? null : 'Date is required'),
						},
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
				{
					key: 'drug',
					label: 'Drug / vaccine name *',
					placeholder: 'e.g. Ivermectin, BoviShield',
					validate: v => (String(v ?? '').trim() ? null : 'Drug / vaccine name is required'),
				},
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
			onSave: () => this._save(rec.id, isNew, options),
			...(!isNew && {
				confirmDelete: { header: `Delete this ${rec.type || 'health'} record for ${animalLabel(animal)}?` },
				onDelete: async () => {
					try {
						if (keepOpenIfFailed(await deleteHealthRecord(rec.id), 'Delete') === false) return false;

						options.onDelete?.();
					} catch (err) {
						new Notify({ type: 'error', textContent: err.message || 'Delete failed', timeout: 4000 });

						return false;
					}
				},
			}),
			...withoutCallbacks(options),
		});

		// Computed withdrawal date display — reactive to date + withdrawalDays changes
		const withdrawalDisplay = new Elem({
			tag: 'div',
			appendTo: this.body,
			style: { fontSize: '13px', color: colors.light(colors.warning), fontWeight: '600', padding: '4px 0 8px' },
		});

		const updateWithdrawal = () => {
			const dateVal = this.form.options.data.date;
			const days = parseInt(this.form.options.data.withdrawalDays, 10);
			if (dateVal && days > 0) {
				const d = parseDate(dateVal);
				d.setDate(d.getDate() + days);
				withdrawalDisplay.options.textContent = `Withdrawal until: ${toDateOnly(d)}`;
				withdrawalDisplay.options.style = { color: colors.light(colors.warning) };
			} else {
				withdrawalDisplay.options.textContent = '';
			}
		};

		this.form.options.data.addEventListener('set', updateWithdrawal);
		updateWithdrawal();

		if (!isNew) {
			this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'health-records', rec.id));
		}
	}

	async _save(id, isNew, options) {
		const data = Object.fromEntries(
			Object.keys(this.form.inputElements).map(k => [k, this.form.inputElements[k].options.value]),
		);
		data.animalId = options.animal?.id || options.animalId;

		try {
			const fn = isNew ? createHealthRecord : body => updateHealthRecord(id, body);
			const result = await fn({ body: data });

			if (keepOpenIfFailed(result) === false) return false;

			options.onSave?.(result?.body);
		} catch (err) {
			new Notify({ type: 'error', textContent: err.message || 'Save failed', timeout: 4000 });

			return false;
		}
	}
}
