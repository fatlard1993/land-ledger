import { Button, Component, Elem, EmptyState, styled, Table, theme, Toolbar } from '@vanilla-bean/components';

import AsyncView from '../AsyncView';
import { getAnimals, getFields } from '../api';
import { PageView } from '../Layout';
import context from '../context';

import { ageLabel, speciesMeta, STATUS_COLORS } from './constants';
import AnimalDialog from './AnimalDialog';
import AnimalPanel from './AnimalPanel';

const { colors, space } = theme;

// One animal per row, which opens its panel; a phone keeps the tag, name, species and status
const AnimalTable = styled(
	Table,
	({ colors, fonts, media, space }) => `
		width: 100%;
		border-collapse: collapse;
		/* The name takes what the fixed columns leave, as the old grid's 1fr did */
		table-layout: fixed;

		th {
			padding: ${space.xs} ${space.sm} ${space.sm} 0;
			border-bottom: 1px solid ${colors.border};
			font-size: 10px;
			font-weight: 500;
			letter-spacing: 0.06em;
			text-align: left;
			text-transform: uppercase;
			color: ${colors.muted};
		}

		td {
			padding: ${space.sm} ${space.sm} ${space.sm} 0;
			border-bottom: 1px solid ${colors.border};
			vertical-align: middle;
			font-size: 12px;
			color: ${colors.muted};
			cursor: pointer;
		}

		tr:hover td { background: ${colors.alpha(colors.white, 0.03)}; }

		& .tag { width: 80px; font-family: ${fonts.family.code}; }
		& .name-text {
			overflow: hidden;
			font-size: 13px;
			font-weight: 600;
			color: ${colors.white};
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		& .breed { font-size: 11px; color: ${colors.muted}; }
		& .species { width: 90px; }
		& .field { width: 100px; }
		& td.field { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
		& .age { width: 80px; }
		& .status { width: 70px; }
		& td.status { font-size: 11px; font-weight: 600; }

		@media ${media.phone} {
			& .tag { width: 64px; }
			& .species { width: 84px; }
			& .status { width: 64px; }
			& .field, & .age { display: none; }
		}
	`,
);

export default class Animals extends AsyncView {
	_speciesFilter = '';

	_buildView() {
		this.toolbar = new Toolbar({ appendTo: this, variant: 'bar', heading: 'Animals', gap: 8, wrap: false });
		new Button({
			appendTo: this.toolbar,
			icon: 'plus',
			title: 'Add animal',
			onPointerPress: () =>
				new AnimalDialog({
					onSave: result => {
						if (result && this._animals?.body) this._animals.body[result.id] = result;
						context.hasAnimals = true;
						this._render();
					},
				}),
		});

		this.content = new PageView({ appendTo: this });
	}

	_datasources() {
		return { _animals: getAnimals, _fields: getFields };
	}

	_onData() {
		this._render();
	}

	_render() {
		this.content.empty();

		const all = Object.values(this._animals?.body || {});
		const fieldMap = this._fields?.body || {};

		context.hasAnimals = all.length > 0;

		if (!all.length) {
			new EmptyState({
				appendTo: this.content,
				icon: 'paw',
				title: 'No animals registered',
				message: 'Add animals to track individual health records, breeding, and treatments with withdrawal periods',
			});
			return;
		}

		const active = all.filter(a => a.status === 'active' || !a.status);

		// ── Species filter chips ──────────────────────────────────────────────────
		const presentSpecies = [...new Set(all.map(a => a.species).filter(Boolean))];

		if (presentSpecies.length > 1) {
			const chipRow = new Component({
				appendTo: this.content,
				style: { display: 'flex', gap: space.sm, flexWrap: 'wrap', marginBottom: space.xs },
			});

			const makeChip = (value, label) =>
				new Button({
					appendTo: chipRow,
					variant: 'chip',
					...(this._speciesFilter === value && { addClass: 'active' }),
					textContent: label,
					onPointerPress: () => {
						this._speciesFilter = this._speciesFilter === value ? '' : value;
						this._render();
					},
				});

			makeChip('', 'All');
			for (const species of presentSpecies) {
				const meta = speciesMeta(species);
				makeChip(species, `${meta.icon} ${meta.label}`);
			}
		}

		// ── Summary bar ───────────────────────────────────────────────────────────
		const summaryRow = new Component({
			appendTo: this.content,
			style: { display: 'flex', gap: space.md, flexWrap: 'wrap', marginBottom: space.xs },
		});
		const speciesCounts = {};
		for (const a of active) speciesCounts[a.species || 'other'] = (speciesCounts[a.species || 'other'] || 0) + 1;

		for (const [speciesKey, count] of Object.entries(speciesCounts)) {
			const meta = speciesMeta(speciesKey);
			new Elem({
				tag: 'span',
				appendTo: summaryRow,
				style: { fontSize: '12px', color: colors.muted },
				textContent: `${meta.icon} ${count} ${meta.label}`,
			});
		}

		// ── Animal list ───────────────────────────────────────────────────────────
		const filtered = all
			.filter(a => !this._speciesFilter || a.species === this._speciesFilter)
			.sort((a, b) => (a.tagId || '').localeCompare(b.tagId || ''));

		// Pressing anywhere in a row opens the animal; from the keyboard, its tag is the row's one stop
		const opens = animal => ({ onPointerPress: () => this._openPanel(animal) });

		new AnimalTable({
			appendTo: this.content,
			data: filtered,
			columns: [
				{
					key: 'tagId',
					content: 'Tag',
					addClass: 'tag',
					dataColumn: ({ rowData }) => ({
						...opens(rowData),
						addClass: 'tag',
						pressable: true,
						attributes: { 'aria-label': `Open ${rowData.name || (rowData.tagId ? `#${rowData.tagId}` : 'animal')}` },
						textContent: rowData.tagId ? `#${rowData.tagId}` : '—',
					}),
				},
				{
					key: 'name',
					content: 'Name / Breed',
					addClass: 'name',
					dataColumn: ({ rowData }) => ({
						...opens(rowData),
						addClass: 'name',
						append: [
							rowData.name && new Elem({ addClass: 'name-text', textContent: rowData.name }),
							rowData.breed && new Elem({ addClass: 'breed', textContent: rowData.breed }),
						].filter(Boolean),
					}),
				},
				{
					key: 'species',
					content: 'Species',
					addClass: 'species',
					dataColumn: ({ rowData }) => {
						const meta = speciesMeta(rowData.species);

						return { ...opens(rowData), addClass: 'species', textContent: `${meta.icon} ${meta.label}` };
					},
				},
				{
					key: 'fieldId',
					content: 'Field',
					addClass: 'field',
					dataColumn: ({ rowData }) => ({
						...opens(rowData),
						addClass: 'field',
						textContent: fieldMap[rowData.fieldId]?.name || '—',
					}),
				},
				{
					key: 'birthDate',
					content: 'Age',
					addClass: 'age',
					dataColumn: ({ rowData }) => ({
						...opens(rowData),
						addClass: 'age',
						textContent: ageLabel(rowData.birthDate) || '—',
					}),
				},
				{
					key: 'status',
					content: 'Status',
					addClass: 'status',
					dataColumn: ({ rowData }) => ({
						...opens(rowData),
						addClass: 'status',
						style: { color: STATUS_COLORS[rowData.status] || STATUS_COLORS.active },
						textContent: rowData.status || 'active',
					}),
				},
			],
		});
	}

	_openPanel(animal) {
		new AnimalPanel({
			animal,
			onUpdate: updated => {
				if (updated && this._animals?.body) {
					this._animals.body[updated.id] = updated;
				} else if (!updated && this._animals?.body) {
					delete this._animals.body[animal.id];
					context.hasAnimals = Object.keys(this._animals.body).length > 0;
				}
				this._render();
			},
		});
	}
}
