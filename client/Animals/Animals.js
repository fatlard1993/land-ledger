import { Button, Component, Elem, EmptyState, Icon, styled } from '@vanilla-bean/components';

import AsyncView from '../AsyncView';
import { getAnimals, getFields } from '../api';
import { PageView, PageToolbar, PageTitle } from '../Layout';
import context from '../context';

import { ageLabel, speciesMeta, STATUS_COLORS } from './constants';
import AnimalDialog from './AnimalDialog';
import AnimalPanel from './AnimalPanel';

const AnimalRow = styled(
	Component,
	() => `
	display: grid;
	grid-template-columns: 80px 1fr 90px 100px 80px 70px;
	gap: 6px;
	padding: 8px 0;
	border-bottom: 1px solid rgba(255,255,255,0.05);
	cursor: pointer;
	align-items: center;
	&:hover { background: rgba(255,255,255,0.02); }
`,
);

export default class Animals extends AsyncView {
	_speciesFilter = '';

	_buildView() {
		this.toolbar = new PageToolbar({ appendTo: this });
		new PageTitle({ appendTo: this.toolbar, textContent: 'Animals' });
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
				style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' },
			});
			const chips = [];

			const makeChip = (value, label) => {
				const chip = new Component({
					appendTo: chipRow,
					style: {
						padding: '5px 12px',
						borderRadius: '20px',
						border: `1px solid ${this._speciesFilter === value ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
						background: this._speciesFilter === value ? 'rgba(255,255,255,0.12)' : 'transparent',
						fontSize: '12px',
						color: '#fff',
						cursor: 'pointer',
					},
				});
				new Elem({ tag: 'span', appendTo: chip, textContent: label });
				chip.onPointerPress(() => {
					this._speciesFilter = this._speciesFilter === value ? '' : value;
					this._render();
				});
				chips.push(chip);
			};

			makeChip('', 'All');
			for (const species of presentSpecies) {
				const meta = speciesMeta(species);
				makeChip(species, `${meta.icon} ${meta.label}`);
			}
		}

		// ── Summary bar ───────────────────────────────────────────────────────────
		const summaryRow = new Component({
			appendTo: this.content,
			style: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' },
		});
		const speciesCounts = {};
		for (const a of active) speciesCounts[a.species || 'other'] = (speciesCounts[a.species || 'other'] || 0) + 1;

		for (const [speciesKey, count] of Object.entries(speciesCounts)) {
			const meta = speciesMeta(speciesKey);
			new Elem({
				tag: 'span',
				appendTo: summaryRow,
				style: { fontSize: '12px', color: 'rgba(255,255,255,0.5)' },
				textContent: `${meta.icon} ${count} ${meta.label}`,
			});
		}

		// ── Animal list ───────────────────────────────────────────────────────────
		const filtered = all
			.filter(a => !this._speciesFilter || a.species === this._speciesFilter)
			.sort((a, b) => (a.tagId || '').localeCompare(b.tagId || ''));

		// Column header
		const header = new Component({
			appendTo: this.content,
			style: {
				display: 'grid',
				gridTemplateColumns: '80px 1fr 90px 100px 80px 70px',
				gap: '6px',
				padding: '3px 0 6px',
				borderBottom: '1px solid rgba(255,255,255,0.08)',
			},
		});
		for (const t of ['Tag', 'Name / Breed', 'Species', 'Field', 'Age', 'Status']) {
			new Elem({
				tag: 'div',
				appendTo: header,
				style: { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em', color: 'rgba(255,255,255,0.3)' },
				textContent: t,
			});
		}

		for (const a of filtered) {
			const statusColor = STATUS_COLORS[a.status] || '#4caf50';
			const field = fieldMap[a.fieldId];

			const row = new AnimalRow({
				appendTo: this.content,
				onPointerPress: () => this._openPanel(a),
			});

			new Elem({
				tag: 'div',
				appendTo: row,
				style: { fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' },
				textContent: a.tagId ? `#${a.tagId}` : '—',
			});

			const nameWrap = new Component({ appendTo: row, style: { minWidth: '0' } });
			if (a.name)
				new Elem({
					tag: 'div',
					appendTo: nameWrap,
					style: {
						fontSize: '13px',
						fontWeight: '600',
						color: '#fff',
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap',
					},
					textContent: a.name,
				});
			if (a.breed)
				new Elem({
					tag: 'div',
					appendTo: nameWrap,
					style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)' },
					textContent: a.breed,
				});

			const meta = speciesMeta(a.species);
			new Elem({
				tag: 'div',
				appendTo: row,
				style: { fontSize: '12px', color: 'rgba(255,255,255,0.6)' },
				textContent: `${meta.icon} ${meta.label}`,
			});
			new Elem({
				tag: 'div',
				appendTo: row,
				style: {
					fontSize: '12px',
					color: 'rgba(255,255,255,0.45)',
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap',
				},
				textContent: field?.name || '—',
			});
			new Elem({
				tag: 'div',
				appendTo: row,
				style: { fontSize: '12px', color: 'rgba(255,255,255,0.5)' },
				textContent: ageLabel(a.birthDate) || '—',
			});
			new Elem({
				tag: 'div',
				appendTo: row,
				style: { fontSize: '11px', fontWeight: '600', color: statusColor },
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
