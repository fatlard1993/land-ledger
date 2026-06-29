import { Component, Elem, Button } from '@vanilla-bean/components';

import { FormLabel, FormInput, FormSelect } from '../Layout';
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

export function buildCoverCropSection(container, prev, g) {
	// Datalist for species autocomplete
	const datalistId = `cc-species-${Math.random().toString(36).slice(2)}`;
	const datalist = document.createElement('datalist');

	datalist.id = datalistId;
	COVER_CROP_SPECIES.forEach(s => {
		const opt = document.createElement('option');

		opt.value = s;
		datalist.append(opt);
	});
	container.elem.append(datalist);

	// Species mix rows
	new FormLabel({ appendTo: container, textContent: 'Species Mix' });

	const mixContainer = new Component({ appendTo: container });
	const speciesRows = [];
	const defaultMixRow = prev.seedMix
		? [{ name: prev.seedMix, rate: '', unit: 'lbs/ac' }]
		: [{ name: '', rate: '', unit: 'lbs/ac' }];
	const prevMix = Array.isArray(prev.species) ? prev.species : defaultMixRow;

	const addSpeciesRow = (rowData = { name: '', rate: '', unit: 'lbs/ac' }) => {
		const row = new Component({
			appendTo: mixContainer,
			style: { display: 'grid', gridTemplateColumns: '1fr 80px 70px 28px', gap: '4px', marginBottom: '4px' },
		});

		const nameEl = new Elem({
			tag: 'input',
			appendTo: row,
			style: {
				display: 'block',
				width: '100%',
				background: 'rgba(255,255,255,0.07)',
				border: '1px solid rgba(255,255,255,0.12)',
				borderRadius: '4px',
				color: '#fff',
				fontSize: '16px',
				padding: '8px 10px',
				boxSizing: 'border-box',
				marginTop: '0',
				fontFamily: 'inherit',
			},
			attributes: { type: 'text', placeholder: 'Species' },
		});

		nameEl.elem.value = rowData.name || '';
		nameEl.elem.setAttribute('list', datalistId);

		const rateEl = new Elem({
			tag: 'input',
			appendTo: row,
			style: {
				display: 'block',
				width: '100%',
				background: 'rgba(255,255,255,0.07)',
				border: '1px solid rgba(255,255,255,0.12)',
				borderRadius: '4px',
				color: '#fff',
				fontSize: '16px',
				padding: '8px 10px',
				boxSizing: 'border-box',
				marginTop: '0',
				fontFamily: 'inherit',
			},
			attributes: { type: 'number', step: '0.1', placeholder: 'Rate' },
		});

		rateEl.elem.value = rowData.rate || '';

		const unitEl = new Elem({
			tag: 'select',
			appendTo: row,
			style: {
				display: 'block',
				width: '100%',
				background: 'rgba(255,255,255,0.07)',
				border: '1px solid rgba(255,255,255,0.12)',
				borderRadius: '4px',
				color: '#fff',
				fontSize: '16px',
				padding: '8px 4px',
				boxSizing: 'border-box',
				marginTop: '0',
				fontFamily: 'inherit',
				cursor: 'pointer',
			},
		});

		for (const { value, label } of RATE_UNITS) {
			const opt = document.createElement('option');

			opt.value = value;
			opt.textContent = label;
			unitEl.elem.append(opt);
		}

		unitEl.elem.value = rowData.unit || 'lbs/ac';

		new Component({
			tag: 'button',
			textContent: '✕',
			appendTo: row,
			style: {
				background: 'rgba(255,255,255,0.07)',
				border: '1px solid rgba(255,255,255,0.12)',
				borderRadius: '4px',
				color: 'rgba(255,255,255,0.5)',
				cursor: 'pointer',
				fontSize: '12px',
				marginTop: '0',
			},
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
		textContent: '+ Add species',
		style: { fontSize: '12px', padding: '4px 10px', marginTop: '4px', marginBottom: '4px' },
		onPointerPress: () => addSpeciesRow(),
	});

	new FormLabel({ appendTo: container, textContent: 'Seeding Method' });
	const seedingMethodSelect = new FormSelect({ appendTo: container });

	for (const { value: v, label: l } of SEEDING_METHODS) {
		const o = document.createElement('option');
		o.value = v;
		o.textContent = l;
		seedingMethodSelect.elem.append(o);
	}

	seedingMethodSelect.elem.value = prev.seedingMethod || 'drilled';

	new FormLabel({ appendTo: container, textContent: 'Termination Method' });
	const terminationSelect = new FormSelect({ appendTo: container });

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
	const ccSeedCostEl = new FormInput({
		appendTo: costRow,
		attributes: { type: 'number', step: '0.01', placeholder: 'Optional' },
	});

	ccSeedCostEl.elem.value = prev.seedCostPerAcre || '';

	new FormLabel({ appendTo: costRow, textContent: 'Application Cost/Acre ($)' });
	const ccAppCostEl = new FormInput({
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
