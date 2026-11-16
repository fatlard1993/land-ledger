import {
	Button,
	Card,
	Component,
	copyToClipboard,
	Dialog,
	Elem,
	Form,
	Notify,
	SectionLabel,
	theme,
} from '@vanilla-bean/components';

import { ChoiceChips } from '../utils/formFields';
import { IconText } from '../statusIcons';
import { AdminSection, EmptyLine, Hint, ItemRow, Reveal, SecretCode, SectionHead } from './parts';

const { space } = theme;

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

	const form = new Card({ style: { marginTop: space.md } });

	form.elem.dataset.shareForm = '1';
	container.append(form.elem);

	const fields = new Form({
		appendTo: form,
		data: { name: '', purpose: 'certification', start: '', end: '', expiresAt: '' },
		inputs: [
			{
				key: 'name',
				label: 'Name / Recipient',
				placeholder: 'e.g. WSDA Inspector 2026, First National Bank',
				validate: value => (String(value ?? '').trim() ? null : 'Name who the link is for'),
			},
			{
				key: 'purpose',
				label: 'Purpose',
				InputComponent: ChoiceChips,
				choices: Object.entries(TEMPLATES).map(([value, { label, icon }]) => ({ value, label, icon })),
				onChange: ({ value }) => (noteEl.elem.textContent = TEMPLATES[value].note),
			},
			{
				type: 'group',
				// minmax(0, …): a plain 1fr won't go below a date input's intrinsic width, which is wider than half a phone
				style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: space.sm },
				inputs: [
					{ key: 'start', label: 'Records from (optional)', type: 'date' },
					{ key: 'end', label: 'Records to (optional)', type: 'date' },
				],
			},
			{ key: 'expiresAt', label: 'Link expiry date (optional)', type: 'date' },
		],
	});
	const value = key => fields.inputElements[key].options.value;

	// What the purpose shares, under its choices
	const noteEl = new Hint({
		textContent: TEMPLATES.certification.note,
		appendTo: fields.inputElements.purpose.elem.parentElement,
	});

	const buttons = new Elem({
		tag: 'div',
		style: { display: 'flex', gap: space.sm, marginTop: space.sm },
		appendTo: form,
	});

	new Button({
		textContent: 'Cancel',
		variant: 'flat',
		appendTo: buttons,
		onPointerPress: () => form.elem.remove(),
	});

	new Button({
		textContent: 'Generate link',
		appendTo: buttons,
		onPointerPress: async () => {
			if (fields.hasErrors()) return;

			const purpose = value('purpose');
			const body = {
				name: value('name').trim(),
				purpose,
				collections: TEMPLATES[purpose].collections,
				dateRange: value('start') || value('end') ? { start: value('start') || null, end: value('end') || null } : null,
				expiresAt: value('expiresAt') || null,
			};

			const res = await fetch('/auth/shares', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});

			if (!res.ok) {
				new Notify({
					intent: 'danger',
					content: `Couldn't create the share link: ${res.statusText || `status ${res.status}`}`,
				});
				return;
			}

			const data = await res.json();
			form.elem.remove();
			showShareLink(container, data, { onRefresh });
		},
	});

	fields.inputElements.name.elem.focus();
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

	new SecretCode({ appendTo: reveal, code: url });

	const actions = new Component({ appendTo: reveal, addClass: 'actions' });

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
		textContent: 'Create link',
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
			size: 'small',
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
			intent: 'danger',
			appendTo: row,
			onPointerPress: async () => {
				if (
					!(await Dialog.confirm({
						header: 'Revoke this share link?',
						body: 'Anyone who has it can no longer open it.',
						confirmLabel: 'Revoke',
						intent: 'danger',
					}))
				)
					return;

				const res = await fetch(`/auth/shares/${s.id}`, { method: 'DELETE' });

				if (!res.ok) {
					new Notify({
						intent: 'danger',
						content: `Couldn't revoke the share link: ${res.statusText || `status ${res.status}`}`,
					});
					return;
				}

				onRefresh();
			},
		});
	}
}
