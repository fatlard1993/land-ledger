import { Component, Elem } from '@vanilla-bean/components';
import { FormLabel, FormInput } from '../Layout';

const PURPOSES = {
	certification: '🌿 Organic / GAP cert',
	audit: '📋 Regulatory audit',
	loan: '🏦 Lender / loan',
	consultant: '🌾 Crop consultant',
	custom: '🔗 Custom',
};

function openShareForm(container, { onRefresh }) {
	const existing = container.querySelector('[data-share-form]');
	if (existing) {
		existing.remove();
		return;
	}

	const TEMPLATES = {
		certification: {
			label: '🌿 Organic / GAP Certification',
			collections: ['applicationLogs', 'events', 'fields'],
			note: 'Application records with EPA numbers + crop history',
		},
		audit: {
			label: '📋 Regulatory Audit',
			collections: ['applicationLogs', 'events', 'fields', 'incidents'],
			note: 'Full compliance documentation package',
		},
		loan: {
			label: '🏦 Lender / Loan Application',
			collections: ['fields', 'equipment', 'revenue', 'loans', 'budgetItems'],
			note: 'Asset registry, revenue history, outstanding debt',
		},
		consultant: {
			label: '🌾 Crop Consultant',
			collections: ['events', 'fields'],
			note: 'Crop history, soil tests, yield data',
		},
	};

	const form = new Elem({
		tag: 'div',
		style: {
			marginTop: '10px',
			padding: '12px',
			background: 'rgba(255,255,255,0.04)',
			border: '1px solid rgba(255,255,255,0.1)',
			borderRadius: '6px',
		},
	});

	form.elem.dataset.shareForm = '1';
	container.append(form.elem);

	new FormLabel({ appendTo: form, textContent: 'Name / Recipient' });
	const nameInput = new FormInput({ appendTo: form, placeholder: 'e.g. WSDA Inspector 2026, First National Bank' });

	new FormLabel({ appendTo: form, textContent: 'Purpose' });

	const chipRow = new Elem({
		tag: 'div',
		style: { display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' },
		appendTo: form,
	});

	let selectedPurpose = 'certification';
	let selectedCollections = TEMPLATES.certification.collections;

	const noteEl = new Elem({
		tag: 'div',
		style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' },
		textContent: TEMPLATES.certification.note,
		appendTo: form,
	});

	const chips = {};
	for (const [key, tpl] of Object.entries(TEMPLATES)) {
		const chip = new Component({
			tag: 'button',
			textContent: tpl.label,
			style: {
				fontSize: '11px',
				padding: '4px 10px',
				borderRadius: '20px',
				border: `1px solid rgba(255,255,255,${key === selectedPurpose ? '0.3' : '0.12'})`,
				background: key === selectedPurpose ? 'rgba(255,255,255,0.12)' : 'transparent',
				color: '#fff',
				cursor: 'pointer',
				fontFamily: 'inherit',
			},
			appendTo: chipRow,
			onPointerPress: () => {
				selectedPurpose = key;
				selectedCollections = TEMPLATES[key].collections;
				noteEl.elem.textContent = TEMPLATES[key].note;
				for (const [k, c] of Object.entries(chips)) {
					c.elem.style.borderColor = k === key ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)';
					c.elem.style.background = k === key ? 'rgba(255,255,255,0.12)' : 'transparent';
				}
			},
		});
		chips[key] = chip;
	}

	new FormLabel({ appendTo: form, textContent: 'Records date range (optional)' });

	const dateRangeRow = new Elem({
		tag: 'div',
		style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '4px' },
		appendTo: form,
	});

	const startInput = new FormInput({ appendTo: dateRangeRow, type: 'date' });
	const endInput = new FormInput({ appendTo: dateRangeRow, type: 'date' });

	new FormLabel({ appendTo: form, textContent: 'Link expiry date (optional)' });
	const expInput = new FormInput({ appendTo: form, type: 'date' });

	const buttons = new Elem({
		tag: 'div',
		style: { display: 'flex', gap: '6px', marginTop: '8px' },
		appendTo: form,
	});

	new Component({
		tag: 'button',
		textContent: 'Cancel',
		style: {
			fontSize: '12px',
			padding: '5px 12px',
			background: 'transparent',
			border: '1px solid rgba(255,255,255,0.12)',
			borderRadius: '4px',
			color: 'rgba(255,255,255,0.5)',
			cursor: 'pointer',
			fontFamily: 'inherit',
		},
		appendTo: buttons,
		onPointerPress: () => form.elem.remove(),
	});

	new Component({
		tag: 'button',
		textContent: 'Generate Link',
		style: {
			fontSize: '12px',
			padding: '5px 14px',
			background: '#2d6a2d',
			border: 'none',
			borderRadius: '4px',
			color: '#fff',
			cursor: 'pointer',
			fontFamily: 'inherit',
			fontWeight: '600',
		},
		appendTo: buttons,
		onPointerPress: async () => {
			const name = nameInput.elem.value.trim();
			if (!name) {
				nameInput.elem.focus();
				return;
			}

			const body = {
				name,
				purpose: selectedPurpose,
				collections: selectedCollections,
				dateRange:
					startInput.elem.value || endInput.elem.value
						? { start: startInput.elem.value || null, end: endInput.elem.value || null }
						: null,
				expiresAt: expInput.elem.value || null,
			};

			const res = await fetch('/auth/shares', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});

			if (!res.ok) return;

			const data = await res.json();
			form.elem.remove();
			showShareLink(container, data, { onRefresh });
		},
	});

	nameInput.elem.focus();
}

function showShareLink(container, data, { onRefresh }) {
	const reveal = new Elem({
		tag: 'div',
		style: {
			marginTop: '10px',
			padding: '12px',
			background: 'rgba(45,106,45,0.12)',
			border: '1px solid rgba(45,106,45,0.35)',
			borderRadius: '6px',
		},
	});

	container.append(reveal.elem);

	const url = `${window.location.origin}/shared/${data.token}`;

	new Elem({
		tag: 'div',
		style: {
			fontSize: '11px',
			fontWeight: '700',
			color: '#4caf50',
			textTransform: 'uppercase',
			letterSpacing: '.06em',
			marginBottom: '4px',
		},
		textContent: `Link created — ${data.name}`,
		appendTo: reveal,
	});

	new Elem({
		tag: 'div',
		style: { fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' },
		textContent:
			'Anyone with this link can view the scoped records — no login required. Revoke it when access is no longer needed.',
		appendTo: reveal,
	});

	// Read-only URL display — custom monospace/green style, not a form input
	const urlEl = new Elem({
		tag: 'input',
		attributes: { type: 'text', readonly: true },
		style: {
			display: 'block',
			width: '100%',
			boxSizing: 'border-box',
			background: 'rgba(0,0,0,0.3)',
			border: '1px solid rgba(255,255,255,0.12)',
			borderRadius: '4px',
			color: '#4caf50',
			fontSize: '11px',
			padding: '7px 10px',
			fontFamily: 'monospace',
			cursor: 'text',
			marginBottom: '6px',
		},
		appendTo: reveal,
	});

	urlEl.elem.value = url;
	urlEl.elem.addEventListener('click', () => urlEl.elem.select());

	const copyBtn = new Component({
		tag: 'button',
		textContent: 'Copy Link',
		style: {
			fontSize: '12px',
			padding: '4px 12px',
			background: 'rgba(255,255,255,0.08)',
			border: '1px solid rgba(255,255,255,0.15)',
			borderRadius: '4px',
			color: '#fff',
			cursor: 'pointer',
			fontFamily: 'inherit',
		},
		appendTo: reveal,
		onPointerPress: async () => {
			await navigator.clipboard.writeText(url).catch(() => urlEl.elem.select());
			copyBtn.elem.textContent = 'Copied ✓';
			setTimeout(() => {
				copyBtn.elem.textContent = 'Copy Link';
			}, 2000);
		},
	});

	new Component({
		tag: 'button',
		textContent: 'Done',
		style: {
			marginLeft: '6px',
			fontSize: '12px',
			padding: '4px 12px',
			background: 'transparent',
			border: '1px solid rgba(255,255,255,0.12)',
			borderRadius: '4px',
			color: 'rgba(255,255,255,0.5)',
			cursor: 'pointer',
			fontFamily: 'inherit',
		},
		appendTo: reveal,
		onPointerPress: () => {
			reveal.elem.remove();
			onRefresh();
		},
	});
}

export async function renderShareLinksSection(container, { onRefresh }) {
	const shares = await fetch('/auth/shares')
		.then(r => (r.ok ? r.json() : []))
		.catch(() => []);

	const sec = new Elem({
		tag: 'div',
		style: { marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' },
		appendTo: container,
	});

	const header = new Elem({
		tag: 'div',
		style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
		appendTo: sec,
	});

	new Elem({
		tag: 'div',
		style: { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,0.35)' },
		textContent: 'Shared Access Links',
		appendTo: header,
	});

	new Component({
		tag: 'button',
		textContent: '+ New Link',
		style: {
			fontSize: '12px',
			padding: '3px 10px',
			background: 'rgba(255,255,255,0.07)',
			border: '1px solid rgba(255,255,255,0.12)',
			borderRadius: '4px',
			color: '#fff',
			cursor: 'pointer',
			fontFamily: 'inherit',
		},
		appendTo: header,
		onPointerPress: () => openShareForm(sec.elem, { onRefresh }),
	});

	new Elem({
		tag: 'div',
		style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '8px', lineHeight: '1.5' },
		textContent:
			'Generate read-only links scoped to specific records — for auditors, certifiers, lenders, or consultants. No login required.',
		appendTo: sec,
	});

	if (!shares.length) {
		new Elem({
			tag: 'div',
			style: { fontSize: '12px', color: 'rgba(255,255,255,0.3)' },
			textContent: 'No active share links',
			appendTo: sec,
		});
	}

	for (const s of shares) {
		const row = new Elem({
			tag: 'div',
			style: {
				display: 'flex',
				alignItems: 'flex-start',
				gap: '8px',
				padding: '7px 0',
				borderBottom: '1px solid rgba(255,255,255,0.06)',
				fontSize: '12px',
			},
			appendTo: sec,
		});

		const rowInfo = new Elem({
			tag: 'div',
			style: { flex: '1', minWidth: '0' },
			appendTo: row,
		});

		new Elem({
			tag: 'div',
			style: { fontWeight: '600', color: '#fff' },
			textContent: s.name,
			appendTo: rowInfo,
		});

		const viewed = s.lastViewed ? `viewed ${s.viewCount}× · last ${s.lastViewed.slice(0, 10)}` : 'never viewed';
		const expires = s.expiresAt ? `expires ${s.expiresAt}` : 'no expiry';

		new Elem({
			tag: 'div',
			style: { color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '1px' },
			textContent: `${PURPOSES[s.purpose] ?? s.purpose}  ·  ${expires}  ·  ${viewed}`,
			appendTo: rowInfo,
		});

		const copyBtn = new Component({
			tag: 'button',
			textContent: 'Copy link',
			style: {
				fontSize: '11px',
				padding: '2px 8px',
				background: 'rgba(74,144,217,0.15)',
				border: '1px solid rgba(74,144,217,0.4)',
				borderRadius: '4px',
				color: '#4a90d9',
				cursor: 'pointer',
				fontFamily: 'inherit',
				flexShrink: '0',
			},
			appendTo: row,
			onPointerPress: async () => {
				// /auth/shares returns safe records without full token — re-fetch to get it
				const full = await fetch('/auth/shares')
					.then(r => r.json())
					.then(list => list.find(x => x.id === s.id)?.token)
					.catch(() => null);
				if (full) {
					await navigator.clipboard.writeText(`${window.location.origin}/shared/${full}`).catch(() => {});
					copyBtn.elem.textContent = 'Copied ✓';
					setTimeout(() => {
						copyBtn.elem.textContent = 'Copy link';
					}, 2000);
				}
			},
		});

		new Component({
			tag: 'button',
			textContent: 'Revoke',
			style: {
				fontSize: '11px',
				padding: '2px 8px',
				background: 'transparent',
				border: '1px solid rgba(224,82,82,0.4)',
				borderRadius: '4px',
				color: '#e05252',
				cursor: 'pointer',
				fontFamily: 'inherit',
				flexShrink: '0',
			},
			appendTo: row,
			onPointerPress: async () => {
				await fetch(`/auth/shares/${s.id}`, { method: 'DELETE' });
				onRefresh();
			},
		});
	}
}
