import { Elem, copyToClipboard, Button } from '@vanilla-bean/components';
import { FormInput } from '../Layout';

function showNewToken(container, data, { onRefresh }) {
	const reveal = new Elem({
		tag: 'div',
		style: {
			marginTop: '10px',
			padding: '12px',
			background: 'rgba(45,106,45,0.15)',
			border: '1px solid rgba(45,106,45,0.4)',
			borderRadius: '6px',
		},
	});

	container.append(reveal.elem);

	new Elem({
		tag: 'div',
		style: {
			fontSize: '11px',
			fontWeight: '700',
			color: '#4caf50',
			textTransform: 'uppercase',
			letterSpacing: '.06em',
			marginBottom: '6px',
		},
		textContent: `Token created — ${data.name}`,
		appendTo: reveal,
	});

	new Elem({
		tag: 'div',
		style: { fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' },
		textContent: 'Copy this token now. It will not be shown again.',
		appendTo: reveal,
	});

	// Read-only token display — custom monospace/green style, not a form input
	const tokenVal = new Elem({
		tag: 'input',
		attributes: { type: 'text', readonly: true },
		style: {
			display: 'block',
			width: '100%',
			boxSizing: 'border-box',
			background: 'rgba(0,0,0,0.4)',
			border: '1px solid rgba(255,255,255,0.12)',
			borderRadius: '4px',
			color: '#4caf50',
			fontSize: '12px',
			padding: '7px 10px',
			fontFamily: 'monospace',
			cursor: 'text',
		},
		appendTo: reveal,
	});

	tokenVal.elem.value = data.token;
	tokenVal.elem.addEventListener('click', () => tokenVal.elem.select());

	const copyBtn = new Button({
		textContent: 'Copy',
		style: {
			marginTop: '6px',
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
			// Where the copy is refused, the token is selected for copying by hand
			if (!(await copyToClipboard(data.token))) return tokenVal.elem.select();

			copyBtn.elem.textContent = 'Copied ✓';
			setTimeout(() => {
				copyBtn.elem.textContent = 'Copy';
			}, 2000);
		},
	});

	new Button({
		textContent: 'Done',
		style: {
			marginTop: '6px',
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

function openTokenForm(container, { onRefresh }) {
	const existing = container.querySelector('[data-token-form]');
	if (existing) {
		existing.remove();
		return;
	}

	const form = new Elem({
		tag: 'div',
		style: {
			marginTop: '8px',
			padding: '10px',
			background: 'rgba(255,255,255,0.04)',
			border: '1px solid rgba(255,255,255,0.1)',
			borderRadius: '6px',
		},
	});

	form.elem.dataset.tokenForm = '1';
	container.append(form.elem);

	const input = new FormInput({ appendTo: form, placeholder: 'Token name (e.g. JD Operations, Home Automation)' });

	const row = new Elem({
		tag: 'div',
		style: { display: 'flex', gap: '6px', marginTop: '8px' },
		appendTo: form,
	});

	new Button({
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
		appendTo: row,
		onPointerPress: () => form.elem.remove(),
	});

	new Button({
		textContent: 'Generate token',
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
		textContent: 'API Tokens',
		appendTo: header,
	});

	new Button({
		textContent: '+ Generate',
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
		onPointerPress: () => openTokenForm(sec.elem, { onRefresh }),
	});

	if (!existing.length) {
		new Elem({
			tag: 'div',
			style: { fontSize: '12px', color: 'rgba(255,255,255,0.3)' },
			textContent: 'No tokens — generate one to enable programmatic access',
			appendTo: sec,
		});
	}

	for (const t of existing) {
		const row = new Elem({
			tag: 'div',
			style: {
				display: 'flex',
				alignItems: 'center',
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
			textContent: t.name,
			appendTo: rowInfo,
		});

		const lastUsed = t.lastUsed ? `last used ${t.lastUsed.slice(0, 10)}` : 'never used';

		new Elem({
			tag: 'div',
			style: { color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '1px', fontFamily: 'monospace' },
			textContent: `${t.tokenPrefix}…  ·  ${lastUsed}`,
			appendTo: rowInfo,
		});

		new Button({
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
				await fetch(`/auth/tokens/${t.id}`, { method: 'DELETE' });
				onRefresh();
			},
		});
	}
}
