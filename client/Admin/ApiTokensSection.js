import { Button, Card, Component, copyToClipboard, Elem, Input, SectionLabel } from '@vanilla-bean/components';

import { AdminSection, EmptyLine, ItemRow, Reveal, SecretField, SectionHead } from './parts';

function showNewToken(container, data, { onRefresh }) {
	const reveal = new Reveal();

	container.append(reveal.elem);

	new Component({ appendTo: reveal, addClass: 'title', textContent: `Token created — ${data.name}` });
	new Component({
		appendTo: reveal,
		addClass: 'note',
		textContent: 'Copy this token now. It will not be shown again.',
	});

	const tokenVal = new SecretField({ appendTo: reveal, attributes: { type: 'text', readonly: true } });

	tokenVal.elem.value = data.token;
	tokenVal.elem.addEventListener('click', () => tokenVal.elem.select());

	const actions = new Component({ appendTo: reveal, addClass: 'actions' });

	const copyBtn = new Button({
		textContent: 'Copy',
		appendTo: actions,
		onPointerPress: async () => {
			// Where the copy is refused, the token is selected for copying by hand
			if (!(await copyToClipboard(data.token))) return tokenVal.elem.select();

			copyBtn.options.icon = 'check';
			copyBtn.elem.textContent = 'Copied';
			setTimeout(() => {
				copyBtn.options.icon = undefined;
				copyBtn.elem.textContent = 'Copy';
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

function openTokenForm(container, { onRefresh }) {
	const existing = container.querySelector('[data-token-form]');
	if (existing) {
		existing.remove();
		return;
	}

	const form = new Card({ style: { marginTop: '8px' } });

	form.elem.dataset.tokenForm = '1';
	container.append(form.elem);

	const input = new Input({ appendTo: form, placeholder: 'Token name (e.g. JD Operations, Home Automation)' });

	const row = new Elem({
		tag: 'div',
		style: { display: 'flex', gap: '6px', marginTop: '8px' },
		appendTo: form,
	});

	new Button({
		textContent: 'Cancel',
		variant: 'flat',
		appendTo: row,
		onPointerPress: () => form.elem.remove(),
	});

	new Button({
		textContent: 'Generate token',
		appendTo: row,
		onPointerPress: async () => {
			const name = input.elem.value.trim();
			if (!name) {
				input.elem.focus();
				return;
			}

			const res = await fetch('/auth/tokens', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name }),
			});
			if (!res.ok) return;

			const data = await res.json();
			form.elem.remove();
			showNewToken(container, data, { onRefresh });
		},
	});

	input.elem.focus();
}

export async function renderApiTokensSection(container, { onRefresh }) {
	const existing = await fetch('/auth/tokens')
		.then(r => (r.ok ? r.json() : []))
		.catch(() => []);

	const sec = new AdminSection({ appendTo: container });

	const header = new SectionHead({ appendTo: sec });

	new SectionLabel({ appendTo: header, textContent: 'API Tokens' });

	new Button({
		textContent: 'Generate',
		icon: 'plus',
		variant: 'flat',
		appendTo: header,
		onPointerPress: () => openTokenForm(sec.elem, { onRefresh }),
	});

	if (!existing.length) {
		new EmptyLine({ appendTo: sec, textContent: 'No tokens — generate one to enable programmatic access' });
	}

	for (const t of existing) {
		const row = new ItemRow({ appendTo: sec });

		const rowInfo = new Component({ appendTo: row, addClass: 'info' });

		new Component({ appendTo: rowInfo, addClass: 'name', textContent: t.name });

		const lastUsed = t.lastUsed ? `last used ${t.lastUsed.slice(0, 10)}` : 'never used';

		new Component({
			appendTo: rowInfo,
			addClass: 'meta',
			style: { fontFamily: 'monospace' },
			textContent: `${t.tokenPrefix}…  ·  ${lastUsed}`,
		});

		new Button({
			textContent: 'Revoke',
			variant: 'flat',
			addClass: 'danger',
			appendTo: row,
			onPointerPress: async () => {
				await fetch(`/auth/tokens/${t.id}`, { method: 'DELETE' });
				onRefresh();
			},
		});
	}
}
