import { Button, Component, Elem, EmptyState, Icon, styled, theme, Toolbar } from '@vanilla-bean/components';

import AsyncView from '../AsyncView';
import { getAnimals, getFields } from '../api';
import { PageView } from '../Layout';
import context from '../context';

import { ageLabel, speciesMeta, STATUS_COLORS } from './constants';
import AnimalDialog from './AnimalDialog';
import AnimalPanel from './AnimalPanel';

const { colors, space } = theme;

// One animal per row; a phone keeps the tag, name, species and status
const AnimalRow = styled(
	Component,
	({ colors, media, space }) => `
		display: grid;
		grid-template-columns: 80px 1fr 90px 100px 80px 70px;
		gap: ${space.sm};
		align-items: center;
		padding: ${space.sm} 0;
		border-bottom: 1px solid ${colors.border};
		font-size: 12px;
		color: ${colors.muted};
		cursor: pointer;

		&:hover { background: ${colors.alpha(colors.white, 0.03)}; }

		& .tag { font-family: monospace; }
		& .name { min-width: 0; }
		& .name-text {
			overflow: hidden;
			font-size: 13px;
			font-weight: 600;
			color: ${colors.white};
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		& .breed { font-size: 11px; color: ${colors.gray}; }
		& .field { overflow: hidden; color: ${colors.gray}; text-overflow: ellipsis; white-space: nowrap; }
		& .status { font-size: 11px; font-weight: 600; }

		&.header {
			padding: ${space.xs} 0 ${space.sm};
			font-size: 10px;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: ${colors.gray};
			cursor: default;

			&:hover { background: none; }
		}

		@media ${media.phone} {
			grid-template-columns: 64px 1fr 84px 64px;

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
			append: new Icon({ icon: 'plus' }),
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
				style: { fontSize: '12px', color: colors.gray },
				textContent: `${meta.icon} ${count} ${meta.label}`,
			});
		}

		// ── Animal list ───────────────────────────────────────────────────────────
		const filtered = all
			.filter(a => !this._speciesFilter || a.species === this._speciesFilter)
			.sort((a, b) => (a.tagId || '').localeCompare(b.tagId || ''));

		// Column header
		const header = new AnimalRow({ appendTo: this.content, addClass: 'header' });
		const columns = {
			tag: 'Tag',
			name: 'Name / Breed',
			species: 'Species',
			field: 'Field',
			age: 'Age',
			status: 'Status',
		};

		for (const [cell, t] of Object.entries(columns)) {
			new Elem({ tag: 'div', appendTo: header, addClass: cell, textContent: t });
		}

		for (const a of filtered) {
			const statusColor = STATUS_COLORS[a.status] || STATUS_COLORS.active;
			const field = fieldMap[a.fieldId];

			const row = new AnimalRow({
				appendTo: this.content,
				onPointerPress: () => this._openPanel(a),
			});

			new Elem({
				tag: 'div',
				appendTo: row,
				addClass: 'tag',
				textContent: a.tagId ? `#${a.tagId}` : '—',
			});

			const nameWrap = new Component({ appendTo: row, addClass: 'name' });
			if (a.name)
				new Elem({
					tag: 'div',
					appendTo: nameWrap,
					addClass: 'name-text',
					textContent: a.name,
				});
			if (a.breed)
				new Elem({
					tag: 'div',
					appendTo: nameWrap,
					addClass: 'breed',
					textContent: a.breed,
				});

			const meta = speciesMeta(a.species);
			new Elem({
				tag: 'div',
				appendTo: row,
				addClass: 'species',
				textContent: `${meta.icon} ${meta.label}`,
			});
			new Elem({
				tag: 'div',
				appendTo: row,
				addClass: 'field',
				textContent: field?.name || '—',
			});
			new Elem({
				tag: 'div',
				appendTo: row,
				addClass: 'age',
				textContent: ageLabel(a.birthDate) || '—',
			});
			new Elem({
				tag: 'div',
				appendTo: row,
				addClass: 'status',
				style: { color: statusColor },
				textContent: a.status || 'active',
			});
		}
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
