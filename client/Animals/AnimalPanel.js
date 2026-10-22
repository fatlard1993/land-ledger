import { Button, Card, Component, Dialog, Elem, formatDate, styled, theme } from '@vanilla-bean/components';

import { ActionHeader } from '../Layout';
import { IconText } from '../statusIcons';

import { getHealthRecords, getBreedingRecords } from '../api/animals';
import { animalLabel, ageLabel, STATUS_COLORS, speciesMeta } from './constants';
import AnimalDialog from './AnimalDialog';
import HealthRecordDialog from './HealthRecordDialog';
import BreedingDialog from './BreedingDialog';

const TODAY = new Date().toISOString().slice(0, 10);

const { colors } = theme;

const BREEDING_STATUS_COLORS = {
	pending: colors.light(colors.warning),
	confirmed: colors.light(colors.success),
	delivered: colors.light(colors.info),
	failed: colors.gray,
};

const PresenceChip = styled(
	Component,
	({ colors, radius }) => `
		align-items: center;
		gap: 6px;
		margin-bottom: 12px;
		padding: 4px 10px;
		border: 1px solid ${colors.alpha(colors.warning, 0.35)};
		border-radius: ${radius.pill};
		background: ${colors.alpha(colors.warning, 0.15)};
		font-size: 11px;
		font-weight: 600;
		color: ${colors.light(colors.warning)};
		white-space: nowrap;
	`,
);

const SummaryCell = styled(
	Component,
	({ colors }) => `
		& .label {
			font-size: 10px;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: ${colors.gray};
		}

		& .value {
			margin-top: 2px;
			font-size: 13px;
			font-weight: 600;
			color: ${colors.muted};
		}
	`,
);

// A health or breeding record: its marker, then what it was and when
const RecordRow = styled(
	Component,
	({ colors }) => `
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 6px 0;
		border-bottom: 1px solid ${colors.border};
		cursor: pointer;

		& .marker {
			flex-shrink: 0;
			margin-top: 1px;
			font-size: 14px;
		}

		& .info {
			flex: 1;
			min-width: 0;
		}

		& .title {
			font-size: 13px;
			font-weight: 500;
			color: ${colors.white};
		}

		& .meta {
			margin-top: 1px;
			font-size: 11px;
			color: ${colors.gray};
		}

		& .flag {
			margin-top: 2px;
			font-size: 11px;
			font-weight: 600;
		}
	`,
);

const Empty = styled(
	Component,
	({ colors }) => `
		padding: 5px 0 12px;
		font-size: 12px;
		color: ${colors.gray};
	`,
);

export default class AnimalPanel extends Dialog {
	constructor(options = {}) {
		super({
			size: 'large',
			header: animalLabel(options.animal),
			buttons: ['Close'],
			onButtonPress: () => this.close(),
			...options,
		});

		this._animal = options.animal;
		this._onUpdate = options.onUpdate;
		this._presenceCount = 0;
		this._presenceBar = null;
		this._presenceHandler = null;

		this._watchAnimal();
		this.addCleanup('presence', () => this._clearWatch());
		this._render();
	}

	_watchAnimal() {
		const { id } = this._animal;

		fetch('/presence', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ collection: 'animals', id, action: 'open' }),
		}).catch(() => {});

		this._presenceHandler = e => {
			if (e.detail.collection !== 'animals' || e.detail.id !== id) return;
			this._presenceCount = e.detail.count;
			this._updatePresenceBar();
		};

		document.addEventListener('livesync:presence', this._presenceHandler);
	}

	_clearWatch() {
		if (this._presenceHandler) {
			document.removeEventListener('livesync:presence', this._presenceHandler);
			this._presenceHandler = null;
		}

		fetch('/presence', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ collection: 'animals', id: this._animal.id, action: 'close' }),
		}).catch(() => {});
	}

	_updatePresenceBar() {
		if (!this._presenceBar) return;

		const others = this._presenceCount - 1; // count includes this client

		if (others > 0) {
			this._presenceBar.elem.textContent = `● ${others} other${others !== 1 ? 's' : ''} viewing`;
			this._presenceBar.elem.style.display = 'flex';
		} else {
			this._presenceBar.elem.style.display = 'none';
		}
	}

	async _render() {
		this.body.empty();

		// Presence indicator — rebuilt after each body.empty(), updated in place by _updatePresenceBar
		this._presenceBar = new PresenceChip({ appendTo: this.body, style: { display: 'none' } });

		this._updatePresenceBar();

		const [healthData, breedingData] = await Promise.all([
			getHealthRecords().catch(() => ({ body: {} })),
			getBreedingRecords().catch(() => ({ body: {} })),
		]);

		const a = this._animal;
		const health = Object.values(healthData?.body || {})
			.filter(r => r.animalId === a.id)
			.sort((x, y) => new Date(y.date) - new Date(x.date));
		const breeding = Object.values(breedingData?.body || {})
			.filter(r => r.damId === a.id)
			.sort((x, y) => new Date(y.breedingDate) - new Date(x.breedingDate));
		const isFemale = a.sex === 'female' || !a.sex;
		const statusColor = STATUS_COLORS[a.status] || STATUS_COLORS.active;

		// ── Animal summary ───────────────────────────────────────────────────────
		const summary = new Card({
			appendTo: this.body,
			style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' },
		});

		const summaryRow = (label, value, color) => {
			const cell = new SummaryCell({ appendTo: summary });
			new Elem({ tag: 'div', appendTo: cell, addClass: 'label', textContent: label });
			new Elem({
				tag: 'div',
				appendTo: cell,
				addClass: 'value',
				style: color ? { color } : {},
				textContent: value || '—',
			});
		};

		summaryRow('Species', `${speciesMeta(a.species)?.icon} ${a.species || '—'}`);
		summaryRow('Breed', a.breed || '—');
		summaryRow('Sex', a.sex || '—');
		summaryRow('Tag / ID', a.tagId ? `#${a.tagId}` : '—');
		summaryRow('Age', ageLabel(a.birthDate) || '—');
		summaryRow('Status', a.status || 'active', statusColor);
		if (a.dam) summaryRow('Dam', a.dam);
		if (a.sire) summaryRow('Sire', a.sire);

		const editRow = new Component({
			appendTo: this.body,
			style: { display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' },
		});
		new Button({
			appendTo: editRow,
			icon: 'pen',
			textContent: 'Edit animal',
			onPointerPress: () =>
				new AnimalDialog({
					animal: this._animal,
					onSave: updated => {
						if (updated) this._animal = updated;
						this._onUpdate?.(updated);
						this._render();
					},
					onDelete: () => {
						this._onUpdate?.(null);
						this.close();
					},
				}),
		});

		// ── Health records ───────────────────────────────────────────────────────
		const header1 = new ActionHeader({ appendTo: this.body, title: 'Health Records' });
		new Button({
			appendTo: header1,
			icon: 'plus',
			textContent: 'Add',
			onPointerPress: () =>
				new HealthRecordDialog({
					animal: a,
					onSave: () => this._render(),
				}),
		});

		if (!health.length) {
			new Empty({ appendTo: this.body, textContent: 'No records yet' });
		} else {
			const healthList = new Component({ appendTo: this.body, style: { marginBottom: '14px' } });

			for (const r of health) {
				const isWithdrawal = r.withdrawalDate && r.withdrawalDate > TODAY;
				const row = new RecordRow({ appendTo: healthList });

				const icon = { vaccination: '💉', treatment: '💊', observation: '👁️', injury: '🩹' }[r.type] || '🏥';
				new Elem({ tag: 'span', appendTo: row, addClass: 'marker', textContent: icon });

				const info = new Component({ appendTo: row, addClass: 'info' });
				new Elem({ tag: 'div', appendTo: info, addClass: 'title', textContent: r.drug || r.type || 'Record' });

				const meta = [formatDate(r.date) || '—', r.dose, r.route].filter(Boolean).join(' · ');
				if (meta) new Elem({ tag: 'div', appendTo: info, addClass: 'meta', textContent: meta });

				if (isWithdrawal) {
					new IconText({
						appendTo: info,
						addClass: 'flag',
						style: { color: colors.light(colors.warning) },
						icon: 'triangle-exclamation',
						textContent: `Withdrawal until ${r.withdrawalDate}`,
					});
				}

				row.onPointerPress(
					() =>
						new HealthRecordDialog({
							record: r,
							animal: a,
							onSave: () => this._render(),
							onDelete: () => this._render(),
						}),
				);
			}
		}

		// ── Breeding records (females only) ──────────────────────────────────────
		if (isFemale) {
			const header2 = new ActionHeader({ appendTo: this.body, title: 'Breeding Records' });
			new Button({
				appendTo: header2,
				icon: 'plus',
				textContent: 'Add',
				onPointerPress: () =>
					new BreedingDialog({
						dam: a,
						onSave: () => this._render(),
					}),
			});

			if (!breeding.length) {
				new Empty({ appendTo: this.body, textContent: 'No breeding records' });
			} else {
				for (const r of breeding) {
					const upcoming =
						r.expectedDueDate && r.expectedDueDate > TODAY && r.status !== 'delivered' && r.status !== 'failed';
					const row = new RecordRow({ appendTo: this.body });

					new Elem({ tag: 'span', appendTo: row, addClass: 'marker', textContent: '🐣' });

					const info = new Component({ appendTo: row, addClass: 'info' });
					const statusColor = BREEDING_STATUS_COLORS[r.status] || colors.gray;
					const statusLabel =
						{ pending: 'Pending', confirmed: 'Confirmed', delivered: 'Delivered', failed: 'Failed' }[r.status] ||
						r.status;

					new Elem({
						tag: 'div',
						appendTo: info,
						addClass: 'title',
						style: { color: statusColor, fontWeight: '600' },
						textContent: `${statusLabel} — bred ${formatDate(r.breedingDate) || '—'}`,
					});

					const parts = [];
					if (r.sire) parts.push(`sire: ${r.sire}`);
					if (upcoming) parts.push(`due ${r.expectedDueDate}`);
					if (r.actualBirthDate) parts.push(`born ${formatDate(r.actualBirthDate) || '—'}`);
					if (r.litterSize) parts.push(`${r.litterSize} born, ${r.offspringSurvived ?? r.litterSize} survived`);
					if (parts.length) new Elem({ tag: 'div', appendTo: info, addClass: 'meta', textContent: parts.join(' · ') });

					if (upcoming) {
						const daysLeft = Math.ceil((new Date(r.expectedDueDate) - new Date()) / 86_400_000);
						new IconText({
							appendTo: info,
							addClass: 'flag',
							style: { color: colors.light(colors.success) },
							icon: 'calendar-days',
							textContent: `Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
						});
					}

					row.onPointerPress(
						() =>
							new BreedingDialog({
								record: r,
								dam: a,
								onSave: () => this._render(),
								onDelete: () => this._render(),
							}),
					);
				}
			}
		}
	}
}
