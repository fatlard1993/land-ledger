import { Dialog, Component, Elem, Button } from '@vanilla-bean/components';

const toLabel = key => key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

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

// Button style tokens — applied directly to .elem.style to update in place
const BTN_ON = { background: 'rgba(74,144,217,0.25)', borderColor: '#4a90d9', color: '#4a90d9' };
const BTN_OFF = { background: 'transparent', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.45)' };

const applyBtnStyle = (btn, on) => {
	btn.elem.style.background = on ? BTN_ON.background : BTN_OFF.background;
	btn.elem.style.borderColor = on ? BTN_ON.borderColor : BTN_OFF.borderColor;
	btn.elem.style.color = on ? BTN_ON.color : BTN_OFF.color;
};

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

		new Elem({
			tag: 'p',
			appendTo: dialog.body,
			style: { fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '0 0 12px' },
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
			style: { display: 'flex', gap: '8px', marginBottom: '14px' },
		});

		new Button({
			appendTo: shortcuts,
			textContent: 'Keep all mine',
			style: { fontSize: '12px', padding: '4px 10px' },
			onPointerPress: () => applyAll('mine'),
		});
		new Button({
			appendTo: shortcuts,
			textContent: "Use all server's",
			style: { fontSize: '12px', padding: '4px 10px' },
			onPointerPress: () => applyAll('theirs'),
		});

		const cardsWrap = new Component({ appendTo: dialog.body, style: { maxHeight: '420px', overflowY: 'auto' } });

		for (const { entry, current, conflictingFields } of conflicts) {
			const card = new Component({
				appendTo: cardsWrap,
				style: {
					background: 'rgba(255,255,255,0.04)',
					border: '1px solid rgba(255,255,255,0.1)',
					borderRadius: '6px',
					padding: '10px 12px',
					marginBottom: '8px',
				},
			});

			const snapshot = entry.snapshot;
			const label = entityLabel(snapshot || current);
			const collection = (entry.url.split('/')[1] ?? '').replace(/-/g, ' ');

			new Elem({
				tag: 'div',
				appendTo: card,
				style: { fontWeight: '600', fontSize: '13px', marginBottom: '8px', color: '#fff' },
				textContent: label ? `${label} (${collection})` : collection,
			});

			// Column headers
			const header = new Component({
				appendTo: card,
				style: {
					display: 'grid',
					gridTemplateColumns: '100px 1fr 1fr 130px',
					gap: '6px',
					padding: '3px 0',
					borderBottom: '1px solid rgba(255,255,255,0.08)',
					marginBottom: '4px',
				},
			});

			for (const t of ['Field', 'Your version', "Server's version", '']) {
				new Elem({
					tag: 'div',
					appendTo: header,
					style: {
						fontSize: '10px',
						textTransform: 'uppercase',
						letterSpacing: '.06em',
						color: 'rgba(255,255,255,0.3)',
					},
					textContent: t,
				});
			}

			const perField = decisions.get(entry.timestamp);

			for (const { key, serverValue, ourValue } of conflictingFields) {
				const row = new Component({
					appendTo: card,
					style: {
						display: 'grid',
						gridTemplateColumns: '100px 1fr 1fr 130px',
						gap: '6px',
						alignItems: 'center',
						padding: '5px 0',
						borderBottom: '1px solid rgba(255,255,255,0.05)',
						fontSize: '12px',
					},
				});

				new Elem({
					tag: 'div',
					appendTo: row,
					style: { color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
					textContent: toLabel(key),
				});

				const myValueCell = new Elem({ tag: 'div', appendTo: row, textContent: formatVal(ourValue) });
				const serverValueCell = new Elem({ tag: 'div', appendTo: row, textContent: formatVal(serverValue) });
				const toggleRow = new Component({ appendTo: row, style: { display: 'flex', gap: '4px' } });

				const mineBtn = new Button({
					appendTo: toggleRow,
					textContent: 'Mine',
					style: { fontSize: '11px', padding: '2px 7px', border: '1px solid' },
					onPointerPress: () => applyChoice('mine'),
				});
				const theirsBtn = new Button({
					appendTo: toggleRow,
					textContent: "Server's",
					style: { fontSize: '11px', padding: '2px 7px', border: '1px solid' },
					onPointerPress: () => applyChoice('theirs'),
				});

				const applyChoice = choice => {
					perField[key] = choice;

					applyBtnStyle(mineBtn, choice === 'mine');
					applyBtnStyle(theirsBtn, choice === 'theirs');

					myValueCell.elem.style.color = choice === 'mine' ? '#fff' : 'rgba(255,255,255,0.28)';
					myValueCell.elem.style.fontWeight = choice === 'mine' ? '600' : '400';
					serverValueCell.elem.style.color = choice === 'theirs' ? '#fff' : 'rgba(255,255,255,0.28)';
					serverValueCell.elem.style.fontWeight = choice === 'theirs' ? '600' : '400';
				};

				applyChoice(perField[key]); // apply initial state
				rowUpdaters.push({ applyChoice });
			}
		}
	});
}
