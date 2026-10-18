import { Dialog, Component, Elem, Button } from '@vanilla-bean/components';

import { getHealthRecords, getBreedingRecords } from '../api/animals';
import { formatDate } from '../utils/dates';
import { animalLabel, ageLabel, STATUS_COLORS, speciesMeta } from './constants';
import AnimalDialog from './AnimalDialog';
import HealthRecordDialog from './HealthRecordDialog';
import BreedingDialog from './BreedingDialog';

const TODAY = new Date().toISOString().slice(0, 10);

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

	close() {
		this._clearWatch();
		super.close();
	}

	async _render() {
		this.body.empty();

		// Presence indicator — rebuilt after each body.empty(), updated in place by _updatePresenceBar
		this._presenceBar = new Elem({
			tag: 'div',
			appendTo: this.body,
			style: {
				display: 'none',
				alignItems: 'center',
				gap: '6px',
				fontSize: '11px',
				padding: '4px 10px',
				borderRadius: '10px',
				background: 'rgba(232,196,42,0.15)',
				border: '1px solid rgba(232,196,42,0.35)',
				color: '#e8c42a',
				fontWeight: '600',
				marginBottom: '12px',
				whiteSpace: 'nowrap',
			},
		});

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
		const statusColor = STATUS_COLORS[a.status] || '#4caf50';

		// ── Animal summary ───────────────────────────────────────────────────────
		const summary = new Component({
			appendTo: this.body,
			style: {
				display: 'grid',
				gridTemplateColumns: '1fr 1fr 1fr',
				gap: '8px',
				marginBottom: '14px',
				padding: '10px',
				background: 'rgba(255,255,255,0.04)',
				borderRadius: '8px',
			},
		});

		const summaryRow = (label, value, color = 'rgba(255,255,255,0.7)') => {
			const cell = new Component({ appendTo: summary });
			new Elem({
				tag: 'div',
				appendTo: cell,
				style: { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em', color: 'rgba(255,255,255,0.3)' },
				textContent: label,
			});
			new Elem({
				tag: 'div',
				appendTo: cell,
				style: { fontSize: '13px', color, fontWeight: '600', marginTop: '2px' },
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
			textContent: 'Edit animal',
			style: { fontSize: '12px', padding: '4px 12px' },
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
		const header1 = new Component({
			appendTo: this.body,
			style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
		});
		new Elem({
			tag: 'div',
			appendTo: header1,
			style: { fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.07em', color: 'rgba(255,255,255,0.35)' },
			textContent: 'Health Records',
		});
		new Button({
			appendTo: header1,
			textContent: '+ Add',
			style: { fontSize: '11px', padding: '2px 8px' },
			onPointerPress: () =>
				new HealthRecordDialog({
					animal: a,
					onSave: () => this._render(),
				}),
		});

		if (!health.length) {
			new Elem({
				tag: 'div',
				appendTo: this.body,
				style: { fontSize: '12px', color: 'rgba(255,255,255,0.25)', padding: '5px 0 12px' },
				textContent: 'No records yet',
			});
		} else {
			const healthList = new Component({ appendTo: this.body, style: { marginBottom: '14px' } });

			for (const r of health) {
				const isWithdrawal = r.withdrawalDate && r.withdrawalDate > TODAY;
				const row = new Component({
					appendTo: healthList,
					style: {
						display: 'flex',
						gap: '8px',
						padding: '6px 0',
						borderBottom: '1px solid rgba(255,255,255,0.06)',
						cursor: 'pointer',
						alignItems: 'flex-start',
					},
				});

				const icon = { vaccination: '💉', treatment: '💊', observation: '👁️', injury: '🩹' }[r.type] || '🏥';
				new Elem({
					tag: 'span',
					appendTo: row,
					style: { flexShrink: '0', fontSize: '14px', marginTop: '1px' },
					textContent: icon,
				});

				const info = new Component({ appendTo: row, style: { flex: '1', minWidth: '0' } });
				new Elem({
					tag: 'div',
					appendTo: info,
					style: { fontSize: '13px', color: '#fff', fontWeight: '500' },
					textContent: r.drug || r.type || 'Record',
				});

				const meta = [formatDate(r.date, { empty: '—' }), r.dose, r.route].filter(Boolean).join(' · ');
				if (meta)
					new Elem({
						tag: 'div',
						appendTo: info,
						style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '1px' },
						textContent: meta,
					});

				if (isWithdrawal) {
					new Elem({
						tag: 'div',
						appendTo: info,
						style: { fontSize: '11px', color: '#e8c42a', fontWeight: '600', marginTop: '2px' },
						textContent: `⚠ Withdrawal until ${r.withdrawalDate}`,
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
			const header2 = new Component({
				appendTo: this.body,
				style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
			});
			new Elem({
				tag: 'div',
				appendTo: header2,
				style: {
					fontSize: '12px',
					textTransform: 'uppercase',
					letterSpacing: '.07em',
					color: 'rgba(255,255,255,0.35)',
				},
				textContent: 'Breeding Records',
			});
			new Button({
				appendTo: header2,
				textContent: '+ Add',
				style: { fontSize: '11px', padding: '2px 8px' },
				onPointerPress: () =>
					new BreedingDialog({
						dam: a,
						onSave: () => this._render(),
					}),
			});

			if (!breeding.length) {
				new Elem({
					tag: 'div',
					appendTo: this.body,
					style: { fontSize: '12px', color: 'rgba(255,255,255,0.25)', padding: '5px 0 12px' },
					textContent: 'No breeding records',
				});
			} else {
				for (const r of breeding) {
					const upcoming =
						r.expectedDueDate && r.expectedDueDate > TODAY && r.status !== 'delivered' && r.status !== 'failed';
					const statusColors = { pending: '#e8c42a', confirmed: '#4caf50', delivered: '#4a90d9', failed: '#888' };
					const row = new Component({
						appendTo: this.body,
						style: {
							display: 'flex',
							gap: '8px',
							padding: '6px 0',
							borderBottom: '1px solid rgba(255,255,255,0.06)',
							cursor: 'pointer',
							alignItems: 'flex-start',
						},
					});

					new Elem({
						tag: 'span',
						appendTo: row,
						style: { flexShrink: '0', fontSize: '14px', marginTop: '1px' },
						textContent: '🐣',
					});

					const info = new Component({ appendTo: row, style: { flex: '1', minWidth: '0' } });
					const statusColor = statusColors[r.status] || '#888';
					const statusLabel =
						{ pending: 'Pending', confirmed: 'Confirmed', delivered: 'Delivered', failed: 'Failed' }[r.status] ||
						r.status;

					new Elem({
						tag: 'div',
						appendTo: info,
						style: { fontSize: '13px', color: statusColor, fontWeight: '600' },
						textContent: `${statusLabel} — bred ${formatDate(r.breedingDate, { empty: '—' })}`,
					});

					const parts = [];
					if (r.sire) parts.push(`sire: ${r.sire}`);
					if (upcoming) parts.push(`due ${r.expectedDueDate}`);
					if (r.actualBirthDate) parts.push(`born ${formatDate(r.actualBirthDate, { empty: '—' })}`);
					if (r.litterSize) parts.push(`${r.litterSize} born, ${r.offspringSurvived ?? r.litterSize} survived`);
					if (parts.length)
						new Elem({
							tag: 'div',
							appendTo: info,
							style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '1px' },
							textContent: parts.join(' · '),
						});

					if (upcoming) {
						const daysLeft = Math.ceil((new Date(r.expectedDueDate) - new Date()) / 86_400_000);
						new Elem({
							tag: 'div',
							appendTo: info,
							style: { fontSize: '11px', color: '#4caf50', fontWeight: '600', marginTop: '2px' },
							textContent: `📅 Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
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
