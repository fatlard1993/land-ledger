import { Button, Card, Component, Dialog, Elem, Form, Notify, SectionLabel, theme } from '@vanilla-bean/components';

import { AdminSection, EmptyLine, ItemRow, Reveal, SecretCode, SectionHead } from './parts';

const { space } = theme;

function showNewToken(container, data, { onRefresh }) {
	const reveal = new Reveal();

	container.append(reveal.elem);

	new Component({ appendTo: reveal, addClass: 'title', textContent: `Token created — ${data.name}` });
	new Component({
		appendTo: reveal,
		addClass: 'note',
		textContent: 'Copy this token now. It will not be shown again.',
	});

	new SecretCode({ appendTo: reveal, code: data.token });

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

function openTokenForm(container, { onRefresh }) {
	const existing = container.querySelector('[data-token-form]');
	if (existing) {
		existing.remove();
		return;
	}

	const form = new Card({ style: { marginTop: space.sm } });

	form.elem.dataset.tokenForm = '1';
	container.append(form.elem);

	const fields = new Form({
		appendTo: form,
		data: { name: '' },
		inputs: [
			{
				key: 'name',
				label: 'Token name',
				placeholder: 'e.g. JD Operations, Home Automation',
				validate: value => (String(value ?? '').trim() ? null : 'Name the token'),
			},
		],
	});
	const input = fields.inputElements.name;

	const row = new Elem({
		tag: 'div',
		style: { display: 'flex', gap: space.sm, marginTop: space.sm },
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
			if (fields.hasErrors()) return;

			const name = input.options.value.trim();

			const res = await fetch('/auth/tokens', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name }),
			});

			if (!res.ok) {
				new Notify({
					intent: 'danger',
					content: `Couldn't create the token: ${res.statusText || `status ${res.status}`}`,
				});
				return;
			}

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
			style: { fontFamily: theme.fonts.family.code },
			textContent: `${t.tokenPrefix}…  ·  ${lastUsed}`,
		});

		new Button({
			textContent: 'Revoke',
			variant: 'flat',
			intent: 'danger',
			appendTo: row,
			onPointerPress: async () => {
				if (
					!(await Dialog.confirm({
						header: `Revoke "${t.name}"?`,
						body: 'Anything signing in with this token loses access.',
						confirmLabel: 'Revoke',
						intent: 'danger',
					}))
				)
					return;

				const res = await fetch(`/auth/tokens/${t.id}`, { method: 'DELETE' });

				if (!res.ok) {
					new Notify({
						intent: 'danger',
						content: `Couldn't revoke the token: ${res.statusText || `status ${res.status}`}`,
					});
					return;
				}

				onRefresh();
			},
		});
	}
}
