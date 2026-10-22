import { Button, Card, Component, copyToClipboard, Elem, Input, SectionLabel } from '@vanilla-bean/components';

import { FormLabel } from '../Layout';
import { IconText } from '../statusIcons';
import { AdminSection, EmptyLine, Hint, ItemRow, Reveal, SecretField, SectionHead } from './parts';

const PURPOSES = {
	certification: { label: 'Organic / GAP cert', icon: 'leaf' },
	audit: { label: 'Regulatory audit', icon: 'clipboard-list' },
	loan: { label: 'Lender / loan', icon: 'building-columns' },
	consultant: { label: 'Crop consultant', icon: 'wheat-awn' },
	custom: { label: 'Custom', icon: 'link' },
};

function openShareForm(container, { onRefresh }) {
	const existing = container.querySelector('[data-share-form]');
	if (existing) {
		existing.remove();
		return;
	}

	const TEMPLATES = {
		certification: {
			label: 'Organic / GAP Certification',
			icon: 'leaf',
			collections: ['applicationLogs', 'events', 'fields'],
			note: 'Application records with EPA numbers + crop history',
		},
		audit: {
			label: 'Regulatory Audit',
			icon: 'clipboard-list',
			collections: ['applicationLogs', 'events', 'fields', 'incidents'],
			note: 'Full compliance documentation package',
		},
		loan: {
			label: 'Lender / Loan Application',
			icon: 'building-columns',
			collections: ['fields', 'equipment', 'revenue', 'loans', 'budgetItems'],
			note: 'Asset registry, revenue history, outstanding debt',
		},
		consultant: {
			label: 'Crop Consultant',
			icon: 'wheat-awn',
			collections: ['events', 'fields'],
			note: 'Crop history, soil tests, yield data',
		},
	};

	const form = new Card({ style: { marginTop: '10px' } });

	form.elem.dataset.shareForm = '1';
	container.append(form.elem);

	new FormLabel({ appendTo: form, textContent: 'Name / Recipient' });
	const nameInput = new Input({ appendTo: form, placeholder: 'e.g. WSDA Inspector 2026, First National Bank' });

	new FormLabel({ appendTo: form, textContent: 'Purpose' });

	const chipRow = new Elem({
		tag: 'div',
		style: { display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' },
		appendTo: form,
	});

	let selectedPurpose = 'certification';
	let selectedCollections = TEMPLATES.certification.collections;

	const noteEl = new Hint({ textContent: TEMPLATES.certification.note, appendTo: form });

	const chips = {};
	for (const [key, tpl] of Object.entries(TEMPLATES)) {
		const chip = new Button({
			icon: tpl.icon,
			textContent: tpl.label,
			variant: 'chip',
			appendTo: chipRow,
			onPointerPress: () => {
				selectedPurpose = key;
				selectedCollections = TEMPLATES[key].collections;
				noteEl.elem.textContent = TEMPLATES[key].note;
				for (const [k, c] of Object.entries(chips)) c.toggleClass('active', k === key);
			},
		});
		chip.toggleClass('active', key === selectedPurpose);
		chips[key] = chip;
	}

	new FormLabel({ appendTo: form, textContent: 'Records date range (optional)' });

	const dateRangeRow = new Elem({
		tag: 'div',
		style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '4px' },
		appendTo: form,
	});

	const startInput = new Input({ appendTo: dateRangeRow, type: 'date' });
	const endInput = new Input({ appendTo: dateRangeRow, type: 'date' });

	new FormLabel({ appendTo: form, textContent: 'Link expiry date (optional)' });
	const expInput = new Input({ appendTo: form, type: 'date' });

	const buttons = new Elem({
		tag: 'div',
		style: { display: 'flex', gap: '6px', marginTop: '8px' },
		appendTo: form,
	});

	new Button({
		textContent: 'Cancel',
		variant: 'flat',
		appendTo: buttons,
		onPointerPress: () => form.elem.remove(),
	});

	new Button({
		textContent: 'Generate Link',
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
	const reveal = new Reveal();

	container.append(reveal.elem);

	const url = `${window.location.origin}/shared/${data.token}`;

	new Component({ appendTo: reveal, addClass: 'title', textContent: `Link created — ${data.name}` });
	new Component({
		appendTo: reveal,
		addClass: 'note',
		textContent:
			'Anyone with this link can view the scoped records — no login required. Revoke it when access is no longer needed.',
	});

	const urlEl = new SecretField({ appendTo: reveal, attributes: { type: 'text', readonly: true } });

	urlEl.elem.value = url;
	urlEl.elem.addEventListener('click', () => urlEl.elem.select());

	const actions = new Component({ appendTo: reveal, addClass: 'actions' });

	const copyBtn = new Button({
		textContent: 'Copy Link',
		appendTo: actions,
		onPointerPress: async () => {
			// Where the copy is refused, the link is selected for copying by hand
			if (!(await copyToClipboard(url))) return urlEl.elem.select();

			copyBtn.options.icon = 'check';
			copyBtn.elem.textContent = 'Copied';
			setTimeout(() => {
				copyBtn.options.icon = undefined;
				copyBtn.elem.textContent = 'Copy Link';
			}, 2000);
		},
	});

	new Button({
		textContent: 'Done',
		variant: 'flat',
		appendTo: actions,
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

	const sec = new AdminSection({ appendTo: container });

	const header = new SectionHead({ appendTo: sec });

	new SectionLabel({ appendTo: header, textContent: 'Shared Access Links' });

	new Button({
		textContent: 'New Link',
		icon: 'plus',
		variant: 'flat',
		appendTo: header,
		onPointerPress: () => openShareForm(sec.elem, { onRefresh }),
	});

	new Hint({
		textContent:
			'Generate read-only links scoped to specific records — for auditors, certifiers, lenders, or consultants. No login required.',
		appendTo: sec,
	});

	if (!shares.length) new EmptyLine({ appendTo: sec, textContent: 'No active share links' });

	for (const s of shares) {
		const row = new ItemRow({ appendTo: sec, style: { alignItems: 'flex-start' } });

		const rowInfo = new Component({ appendTo: row, addClass: 'info' });

		new Component({ appendTo: rowInfo, addClass: 'name', textContent: s.name });

		const viewed = s.lastViewed ? `viewed ${s.viewCount}× · last ${s.lastViewed.slice(0, 10)}` : 'never viewed';
		const expires = s.expiresAt ? `expires ${s.expiresAt}` : 'no expiry';

		new IconText({
			addClass: 'meta',
			icon: PURPOSES[s.purpose]?.icon,
			textContent: `${PURPOSES[s.purpose]?.label ?? s.purpose}  ·  ${expires}  ·  ${viewed}`,
			appendTo: rowInfo,
		});

		const copyBtn = new Button({
			textContent: 'Copy link',
			variant: 'chip',
			appendTo: row,
			onPointerPress: async () => {
				// /auth/shares returns safe records without full token — re-fetch to get it
				const full = await fetch('/auth/shares')
					.then(r => r.json())
					.then(list => list.find(x => x.id === s.id)?.token)
					.catch(() => null);
				if (full) {
					if (!(await copyToClipboard(`${window.location.origin}/shared/${full}`))) return;

					copyBtn.options.icon = 'check';
					copyBtn.elem.textContent = 'Copied';
					setTimeout(() => {
						copyBtn.options.icon = undefined;
						copyBtn.elem.textContent = 'Copy link';
					}, 2000);
				}
			},
		});

		new Button({
			textContent: 'Revoke',
			variant: 'flat',
			addClass: 'danger',
			appendTo: row,
			onPointerPress: async () => {
				await fetch(`/auth/shares/${s.id}`, { method: 'DELETE' });
				onRefresh();
			},
		});
	}
}
