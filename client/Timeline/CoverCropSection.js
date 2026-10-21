import { Button, Component, Input, Select, styled } from '@vanilla-bean/components';

import { FormLabel } from '../Layout';
import { makePropertiesEditor } from '../utils/PropertiesEditor';

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
	() => `
		display: grid;
		grid-template-columns: 1fr 80px 70px 30px;
		align-items: center;
		gap: 4px;
		margin-bottom: 4px;

		& input, & select {
			margin-top: 0;
			font-size: 16px;
		}

		& select {
			padding-inline: 4px;
		}
	`,
);

export function buildCoverCropSection(container, prev, g) {
	// Species mix rows
	new FormLabel({ appendTo: container, textContent: 'Species Mix' });

	const mixContainer = new Component({ appendTo: container });
	const speciesRows = [];
	const defaultMixRow = prev.seedMix
		? [{ name: prev.seedMix, rate: '', unit: 'lbs/ac' }]
		: [{ name: '', rate: '', unit: 'lbs/ac' }];
	const prevMix = Array.isArray(prev.species) ? prev.species : defaultMixRow;

	const addSpeciesRow = (rowData = { name: '', rate: '', unit: 'lbs/ac' }) => {
		const row = new MixRow({ appendTo: mixContainer });

		const nameEl = new Input({
			appendTo: row,
			type: 'text',
			placeholder: 'Species',
			value: rowData.name || '',
			suggestions: COVER_CROP_SPECIES,
		});

		const rateEl = new Input({
			appendTo: row,
			type: 'number',
			placeholder: 'Rate',
			value: rowData.rate || '',
			attributes: { step: '0.1' },
		});

		const unitEl = new Select({
			appendTo: row,
			options: RATE_UNITS,
			value: rowData.unit || 'lbs/ac',
		});

		new Button({
			appendTo: row,
			variant: 'flat',
			icon: 'xmark',
			title: 'Remove species',
			onPointerPress: () => {
				const idx = speciesRows.findIndex(r => r.row === row);

				if (idx !== -1) speciesRows.splice(idx, 1);
				mixContainer.elem.removeChild(row.elem);
			},
		});

		speciesRows.push({ row, nameEl, rateEl, unitEl });
	};

	for (const rowData of prevMix) addSpeciesRow(rowData);

	new Button({
		appendTo: container,
		variant: 'flat',
		icon: 'plus',
		textContent: 'Add species',
		style: { margin: '4px 0' },
		onPointerPress: () => addSpeciesRow(),
	});

	new FormLabel({ appendTo: container, textContent: 'Seeding Method' });
	const seedingMethodSelect = new Select({ appendTo: container });

	for (const { value: v, label: l } of SEEDING_METHODS) {
		const o = document.createElement('option');
		o.value = v;
		o.textContent = l;
		seedingMethodSelect.elem.append(o);
	}

	seedingMethodSelect.elem.value = prev.seedingMethod || 'drilled';

	new FormLabel({ appendTo: container, textContent: 'Termination Method' });
	const terminationSelect = new Select({ appendTo: container });

	for (const { value: v, label: l } of TERMINATION_METHODS) {
		const o = document.createElement('option');
		o.value = v;
		o.textContent = l;
		terminationSelect.elem.append(o);
	}

	terminationSelect.elem.value = prev.terminationMethod || 'roller_crimper';

	const costRow = new Component({
		appendTo: container,
		style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
	});

	new FormLabel({ appendTo: costRow, textContent: 'Seed Cost/Acre ($)' });
	const ccSeedCostEl = new Input({
		appendTo: costRow,
		attributes: { type: 'number', step: '0.01', placeholder: 'Optional' },
	});

	ccSeedCostEl.elem.value = prev.seedCostPerAcre || '';

	new FormLabel({ appendTo: costRow, textContent: 'Application Cost/Acre ($)' });
	const ccAppCostEl = new Input({
		appendTo: costRow,
		attributes: { type: 'number', step: '0.01', placeholder: 'Optional' },
	});

	ccAppCostEl.elem.value = prev.applicationCostPerAcre || '';

	const { collect: collectCCProps } = makePropertiesEditor(container, {
		estimatedBiomass:
			prev.estimatedBiomass != null && prev.estimatedBiomass !== '' ? String(prev.estimatedBiomass) : '',
		nCreditLbs: prev.nCreditLbs != null && prev.nCreditLbs !== '' ? String(prev.nCreditLbs) : '',
		outcomeNotes: prev.outcomeNotes || '',
	});

	g.name = () =>
		speciesRows
			.filter(r => r.nameEl.elem.value)
			.map(r => r.nameEl.elem.value)
			.join(' + ') || 'Cover Crop';
	g.details = () => ({
		species: speciesRows
			.filter(r => r.nameEl.elem.value)
			.map(r => ({
				name: r.nameEl.elem.value,
				rate: r.rateEl.elem.value ? Number(r.rateEl.elem.value) : null,
				unit: r.unitEl.elem.value,
			})),
		seedingMethod: seedingMethodSelect.elem.value,
		terminationMethod: terminationSelect.elem.value,
		seedCostPerAcre: ccSeedCostEl.elem.value ? Number(ccSeedCostEl.elem.value) : null,
		applicationCostPerAcre: ccAppCostEl.elem.value ? Number(ccAppCostEl.elem.value) : null,
		...collectCCProps(),
	});
}
