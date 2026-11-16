import { Button, Component, Input, Select, styled, theme } from '@vanilla-bean/components';

import { numberField, PropertiesField } from '../utils/formFields';
import { toNum } from '../utils/format.js';

const { space } = theme;

export const COVER_CROP_SPECIES = [
	'Cereal Rye',
	'Winter Wheat',
	'Oats',
	'Barley',
	'Hairy Vetch',
	'Crimson Clover',
	'Balansa Clover',
	'Red Clover',
	'White Clover',
	'Sunn Hemp',
	'Cowpeas',
	'Turnips',
	'Tillage Radish',
	'Daikon Radish',
	'Sunflowers',
	'Buckwheat',
	'Phacelia',
	'Sorghum-Sudan',
	'BMR Sorghum',
	'Flax',
	'Lentils',
	'Other',
];

export const RATE_UNITS = ['lbs/ac', 'kg/ha', 'seeds/ac', 'oz/ac'].map(u => ({ value: u, label: u }));

export const TERMINATION_METHODS = [
	{ value: 'roller_crimper', label: 'Roller-crimper' },
	{ value: 'herbicide', label: 'Herbicide' },
	{ value: 'winter_kill', label: 'Winter kill' },
	{ value: 'tillage', label: 'Tillage incorporated' },
	{ value: 'grazing_off', label: 'Grazed off' },
	{ value: 'mow', label: 'Mowed' },
	{ value: 'other', label: 'Other' },
];

export const SEEDING_METHODS = [
	{ value: 'drilled', label: 'Drilled' },
	{ value: 'broadcast', label: 'Broadcast' },
	{ value: 'aerial', label: 'Aerial' },
	{ value: 'interseeded', label: 'Interseeded into standing crop' },
	{ value: 'overseeded', label: 'Overseeded' },
];

// 16px keeps a phone from zooming in on focus
const MixRow = styled(
	Component,
	({ space }) => `
		display: grid;
		grid-template-columns: 1fr 80px 70px 30px;
		align-items: center;
		gap: ${space.xs};
		margin-bottom: ${space.xs};

		& input, & select {
			margin-top: 0;
			font-size: 16px;
		}

		& select {
			padding-inline: ${space.xs};
		}
	`,
);

const EMPTY_ROW = { name: '', rate: '', unit: 'lbs/ac' };

/**
 * A cover crop's species mix: rows of a species, its seeding rate and the rate's unit, added and removed as the user
 * likes. Its value is the rows as they're typed, `[{ name, rate, unit }]`.
 * @param {object} [options] - Component options
 * @param {Array<object>} [options.value] - The rows shown
 */
export class SpeciesMixField extends Component {
	static schema = {
		value: {
			get default() {
				return [{ ...EMPTY_ROW }];
			},
			set(value) {
				// A value this field announced itself is already what its rows hold
				if (this._rows && JSON.stringify(value) !== JSON.stringify(this._collect())) this._showRows(value);
			},
		},
	};

	build() {
		// A group, named by the Form's label
		this.elem.setAttribute('role', 'group');

		this._rowsElem = new Component({ appendTo: this });
		this._showRows(this.options.value);

		new Button({
			appendTo: this,
			variant: 'flat',
			icon: 'plus',
			textContent: 'Add species',
			style: { margin: `${space.xs} 0` },
			onPointerPress: () => this._addRow().nameEl.elem.focus(),
		});

		// Held as the rows give it (a row saved without a unit shows lbs/ac), so it saves as it was loaded
		this.options.value = this._collect();
	}

	_collect() {
		return this._rows.map(({ nameEl, rateEl, unitEl }) => ({
			name: nameEl.options.value,
			rate: rateEl.options.value,
			unit: unitEl.options.value,
		}));
	}

	_showRows(value) {
		this._rowsElem.empty();
		this._rows = [];

		for (const row of value || []) this._addRow(row);
	}

	_announce() {
		this.options.value = this._collect();
		this.emit('change', { value: this.options.value });
	}

	_addRow(rowData = EMPTY_ROW) {
		const row = new MixRow({ appendTo: this._rowsElem });
		// The row's own change isn't the field's: it's announced as the whole mix
		const owned = part => {
			part.elem.addEventListener('change', event => {
				event.stopPropagation();
				this._announce();
			});
			part.elem.addEventListener('input', () => this._announce());

			return part;
		};

		const entry = {
			nameEl: owned(
				new Input({
					appendTo: row,
					type: 'text',
					placeholder: 'Species',
					value: rowData.name || '',
					attributes: { 'aria-label': 'Species' },
					suggestions: COVER_CROP_SPECIES,
				}),
			),
			rateEl: owned(
				new Input({
					appendTo: row,
					type: 'number',
					placeholder: 'Rate',
					value: rowData.rate || '',
					attributes: { step: '0.1', 'aria-label': 'Seeding rate' },
				}),
			),
			unitEl: owned(
				new Select({
					appendTo: row,
					options: RATE_UNITS,
					value: rowData.unit || 'lbs/ac',
					attributes: { 'aria-label': 'Rate unit' },
				}),
			),
		};

		new Button({
			appendTo: row,
			variant: 'flat',
			icon: 'xmark',
			title: 'Remove species',
			onPointerPress: () => {
				row.destroy();
				this._rows.splice(this._rows.indexOf(entry), 1);
				this._announce();
			},
		});

		this._rows.push(entry);

		return entry;
	}
}

const coverCrop = data => data.category === 'cover_crop';

const filled = value => (value != null && value !== '' ? String(value) : '');

// A cover crop's fields as they start, from the details it was saved with
export const coverCropData = prev => ({
	ccMix: Array.isArray(prev.species) ? prev.species : [{ ...EMPTY_ROW, name: prev.seedMix || '' }],
	ccSeedingMethod: prev.seedingMethod || 'drilled',
	ccTermination: prev.terminationMethod || 'roller_crimper',
	ccSeedCost: prev.seedCostPerAcre || '',
	ccAppCost: prev.applicationCostPerAcre || '',
	ccProps: {
		estimatedBiomass: filled(prev.estimatedBiomass),
		nCreditLbs: filled(prev.nCreditLbs),
		outcomeNotes: prev.outcomeNotes || '',
	},
});

// A cover crop's fields, as Form inputs shown while the event is a cover crop
export const coverCropInputs = () => [
	{ key: 'ccMix', label: 'Species Mix', condition: coverCrop, InputComponent: SpeciesMixField },
	{
		key: 'ccSeedingMethod',
		label: 'Seeding Method',
		condition: coverCrop,
		InputComponent: Select,
		options: SEEDING_METHODS,
	},
	{
		key: 'ccTermination',
		label: 'Termination Method',
		condition: coverCrop,
		InputComponent: Select,
		options: TERMINATION_METHODS,
	},
	{
		type: 'group',
		style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space.sm },
		inputs: [
			{
				key: 'ccSeedCost',
				label: 'Seed Cost/Acre ($)',
				condition: coverCrop,
				placeholder: 'Optional',
				...numberField({ step: '0.01' }),
			},
			{
				key: 'ccAppCost',
				label: 'Application Cost/Acre ($)',
				condition: coverCrop,
				placeholder: 'Optional',
				...numberField({ step: '0.01' }),
			},
		],
	},
	{ key: 'ccProps', label: 'Properties', condition: coverCrop, InputComponent: PropertiesField },
];

// A cover crop's name and details, as the event saves them: the species named, each with its rate as a number
export const coverCropRecord = data => {
	const species = (data.ccMix || []).filter(row => row.name);

	return {
		name: species.map(row => row.name).join(' + ') || 'Cover Crop',
		details: {
			species: species.map(row => ({ name: row.name, rate: toNum(row.rate), unit: row.unit })),
			seedingMethod: data.ccSeedingMethod,
			terminationMethod: data.ccTermination,
			seedCostPerAcre: toNum(data.ccSeedCost),
			applicationCostPerAcre: toNum(data.ccAppCost),
			...data.ccProps,
		},
	};
};
