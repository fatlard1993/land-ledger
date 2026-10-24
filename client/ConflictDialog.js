import {
	Button,
	capitalize,
	Card,
	Component,
	Dialog,
	Elem,
	fromCamelCase,
	styled,
	theme,
} from '@vanilla-bean/components';

const { space } = theme;

const formatVal = v => {
	if (v == null || v === '') return '—';
	if (typeof v === 'boolean') return v ? 'Yes' : 'No';
	if (typeof v === 'object') return JSON.stringify(v);
	return String(v);
};

const entityLabel = snapshot => {
	if (!snapshot) return null;
	return snapshot.name || snapshot.description || snapshot.type || null;
};

const COLUMNS = 'minmax(70px, 100px) minmax(0, 1fr) minmax(0, 1fr) auto';

const Intro = styled(
	Component,
	({ colors, space }) => `
		margin: 0 0 ${space.md};
		font-size: 13px;
		color: ${colors.gray};
	`,
	{ tag: 'p' },
);

const RecordTitle = styled(
	Component,
	({ colors, space }) => `
		margin-bottom: ${space.sm};
		font-size: 13px;
		font-weight: 600;
		color: ${colors.white};
	`,
);

// On a phone the field's name and the choice take rows of their own, so the two values get the width between them
const Row = styled(
	Component,
	({ colors, media, space }) => `
		display: grid;
		grid-template-columns: ${COLUMNS};
		gap: ${space.sm};
		align-items: center;
		padding: ${space.sm} 0;
		border-bottom: 1px solid ${colors.border};
		font-size: 12px;
		overflow-wrap: anywhere;

		&.head {
			padding: ${space.xs} 0;
			margin-bottom: ${space.xs};
			font-size: 10px;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: ${colors.gray};
		}

		& .key {
			font-weight: 500;
			color: ${colors.gray};
		}

		& .value {
			color: ${colors.gray};
		}

		& .value.kept {
			font-weight: 600;
			color: ${colors.white};
		}

		@media ${media.phone} {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);

			& > :first-child,
			& > :last-child {
				grid-column: 1 / -1;
			}

			&.head > :last-child {
				display: none;
			}
		}
	`,
);

// Shows a field-level conflict resolution dialog.
// Returns a Promise that resolves to:
//   null                    — user cancelled; keep all entries in queue
//   [{ entry, body }]       — resolved entries; body is null if the PATCH should be skipped
export function showConflictDialog(conflicts) {
	return new Promise(resolve => {
		// decisions[entryTimestamp][fieldKey] = 'mine' | 'theirs'
		const decisions = new Map();

		for (const { entry, conflictingFields } of conflicts) {
			const perField = {};

			for (const { key } of conflictingFields) perField[key] = 'mine';

			decisions.set(entry.timestamp, perField);
		}

		const dialog = new Dialog({
			size: 'large',
			header: `Sync Conflicts — ${conflicts.length} record${conflicts.length !== 1 ? 's' : ''}`,
			buttons: ['Apply', 'Cancel'],
			onButtonPress: ({ button }) => {
				if (button === 'Apply') {
					const resolved = conflicts.map(({ entry, conflictingFields }) => {
						const perField = decisions.get(entry.timestamp);
						const patchBody = { ...JSON.parse(entry.body || '{}') };

						// Remove fields the user chose to defer to the server
						for (const { key } of conflictingFields) {
							if (perField[key] === 'theirs') delete patchBody[key];
						}

						return {
							entry,
							body: Object.keys(patchBody).length ? JSON.stringify(patchBody) : null,
						};
					});

					resolve(resolved);
				} else {
					resolve(null);
				}

				dialog.close();
			},
			onClose: () => resolve(null),
		});

		new Intro({
			appendTo: dialog.body,
			textContent:
				'These queued changes conflict with edits made on the server while you were offline. Choose which value to keep for each conflicting field.',
		});

		// rowUpdaters[i] = { applyChoice } — called to update a single row in place
		const rowUpdaters = [];

		const applyAll = choice => {
			for (const { applyChoice } of rowUpdaters) applyChoice(choice);
		};

		// Shortcuts
		const shortcuts = new Component({
			appendTo: dialog.body,
			style: { display: 'flex', gap: space.sm, marginBottom: space.md },
		});

		new Button({
			appendTo: shortcuts,
			variant: 'flat',
			textContent: 'Keep all mine',
			onPointerPress: () => applyAll('mine'),
		});
		new Button({
			appendTo: shortcuts,
			variant: 'flat',
			textContent: "Use all server's",
			onPointerPress: () => applyAll('theirs'),
		});

		const cardsWrap = new Component({ appendTo: dialog.body, style: { maxHeight: '420px', overflowY: 'auto' } });

		for (const { entry, current, conflictingFields } of conflicts) {
			const card = new Card({ appendTo: cardsWrap, style: { marginBottom: space.sm } });

			const snapshot = entry.snapshot;
			const label = entityLabel(snapshot || current);
			const collection = (entry.url.split('/')[1] ?? '').replace(/-/g, ' ');

			new RecordTitle({
				appendTo: card,
				textContent: label ? `${label} (${collection})` : collection,
			});

			// Column headers
			const header = new Row({ appendTo: card, addClass: 'head' });

			for (const t of ['Field', 'Your version', "Server's version", '']) {
				new Elem({ tag: 'div', appendTo: header, textContent: t });
			}

			const perField = decisions.get(entry.timestamp);

			for (const { key, serverValue, ourValue } of conflictingFields) {
				const row = new Row({ appendTo: card });

				new Elem({ tag: 'div', appendTo: row, addClass: 'key', textContent: capitalize(fromCamelCase(key)) });

				const myValueCell = new Elem({
					tag: 'div',
					appendTo: row,
					addClass: 'value',
					textContent: formatVal(ourValue),
				});
				const serverValueCell = new Elem({
					tag: 'div',
					appendTo: row,
					addClass: 'value',
					textContent: formatVal(serverValue),
				});
				const toggleRow = new Component({ appendTo: row, style: { display: 'flex', gap: space.xs } });

				const mineBtn = new Button({
					appendTo: toggleRow,
					variant: 'chip',
					textContent: 'Mine',
					onPointerPress: () => applyChoice('mine'),
				});
				const theirsBtn = new Button({
					appendTo: toggleRow,
					variant: 'chip',
					textContent: "Server's",
					onPointerPress: () => applyChoice('theirs'),
				});

				const applyChoice = choice => {
					perField[key] = choice;

					mineBtn.toggleClass('active', choice === 'mine');
					theirsBtn.toggleClass('active', choice === 'theirs');
					myValueCell.toggleClass('kept', choice === 'mine');
					serverValueCell.toggleClass('kept', choice === 'theirs');
				};

				applyChoice(perField[key]); // apply initial state
				rowUpdaters.push({ applyChoice });
			}
		}
	});
}

// An update's onConflict for a record at `path`: the user picks mine or the server's for each field that differs, and
// the fields to send come back (crudResource sends them over the stored version), or nothing when they cancel
export const resolveConflict =
	path =>
	async ({ current, changes, fields }) => {
		const resolved = await showConflictDialog([
			{
				entry: { timestamp: Date.now(), url: path, method: 'PATCH', body: JSON.stringify(changes), snapshot: null },
				current,
				conflictingFields: fields.map(({ key, ours, theirs }) => ({ key, ourValue: ours, serverValue: theirs })),
			},
		]);

		if (!resolved) return undefined;

		// Every field deferred to the server: sending nothing over the stored version answers with the stored record
		return resolved[0].body === null ? {} : JSON.parse(resolved[0].body);
	};
