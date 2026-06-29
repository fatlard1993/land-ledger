// Full-screen login overlay — shown when auth is enabled and the user has no session.
// Single passkey field; no username. First matching account wins.
import { Component, Elem, styled } from '@vanilla-bean/components';

const LoginOverlay = styled(
	Component,
	() => `
	position: fixed;
	inset: 0;
	z-index: 99999;
	background: #0d0d0d;
	display: flex;
	align-items: center;
	justify-content: center;
	font-family: inherit;
`,
);

const LoginCard = styled(
	Component,
	() => `
	width: min(340px, 90vw);
	padding: 32px;
	background: rgba(255, 255, 255, 0.04);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 12px;
	display: flex;
	flex-direction: column;
	gap: 20px;
`,
);

const LoginInput = styled(
	Component,
	() => `
	display: block;
	width: 100%;
	box-sizing: border-box;
	background: rgba(255, 255, 255, 0.07);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 6px;
	color: #fff;
	font-size: 16px;
	padding: 12px 14px;
	font-family: inherit;
	text-align: center;
	letter-spacing: .15em;
	outline: none;
	transition: border-color 0.15s;

	&:focus {
		border-color: rgba(255, 255, 255, 0.3);
	}
`,
	{ tag: 'input' },
);

const LoginButton = styled(
	Component,
	() => `
	width: 100%;
	padding: 11px;
	border-radius: 6px;
	border: none;
	background: #2d6a2d;
	color: #fff;
	font-size: 14px;
	font-weight: 600;
	cursor: pointer;
	font-family: inherit;
	transition: background 0.15s;

	&:hover {
		background: #3a8a3a;
	}
`,
	{ tag: 'button' },
);

export function mountLoginScreen(onSuccess) {
	const overlay = new LoginOverlay({ appendTo: document.body });

	const card = new LoginCard({ appendTo: overlay });

	new Elem({
		appendTo: card,
		style: { textAlign: 'center' },
		innerHTML: `
			<div style="font-size:36px;margin-bottom:8px">🌾</div>
			<div style="font-size:18px;font-weight:700;color:#fff;letter-spacing:-.01em">Land Ledger</div>
			<div style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:4px">Enter your passkey to continue</div>
		`,
	});

	const input = new LoginInput({
		appendTo: card,
		type: 'password',
		placeholder: 'Passkey',
		autocomplete: 'current-password',
	});

	const errorElem = new Elem({
		appendTo: card,
		style: { fontSize: '12px', color: '#e05252', textAlign: 'center', minHeight: '16px' },
	});

	const btn = new LoginButton({
		appendTo: card,
		type: 'button',
		textContent: 'Continue',
	});

	const attempt = async () => {
		const passkey = input.elem.value;

		if (!passkey) {
			input.elem.focus();
			return;
		}

		btn.options.disabled = true;
		btn.options.textContent = '…';
		errorElem.options.textContent = '';

		try {
			const res = await fetch('/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ passkey }),
			});

			if (res.ok) {
				overlay.destroy();
				onSuccess();
			} else {
				errorElem.options.textContent = 'Invalid passkey';
				input.elem.value = '';
				input.elem.focus();
			}
		} catch {
			errorElem.options.textContent = 'Could not reach server';
		} finally {
			btn.options.disabled = false;
			btn.options.textContent = 'Continue';
		}
	};

	btn.onPointerPress(attempt);

	input.elem.addEventListener('keydown', e => {
		if (e.key === 'Enter') attempt();
	});

	setTimeout(() => input.elem.focus(), 50);

	return overlay;
}
