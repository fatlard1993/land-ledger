// Full-screen login overlay — shown when auth is enabled and the user has no session.
// Single passkey field; no username. First matching account wins.
import { Button, Card, Component, Icon, Input, styled } from '@vanilla-bean/components';

const LoginOverlay = styled(
	Component,
	({ colors }) => `
		position: fixed;
		inset: 0;
		z-index: 99999;
		background: ${colors.black};
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: inherit;
	`,
);

const LoginCard = styled(
	Card,
	({ space }) => `
		width: min(340px, 90vw);
		padding: ${space.xl};
		display: flex;
		flex-direction: column;
		gap: 20px;
	`,
);

const Masthead = styled(
	Component,
	({ colors }) => `
		text-align: center;

		& .logo {
			margin-bottom: 8px;
			font-size: 36px;
			color: ${colors.light(colors.green)};
		}

		& .name {
			font-size: 18px;
			font-weight: 700;
			color: ${colors.white};
		}

		& .hint {
			margin-top: 4px;
			font-size: 12px;
			color: ${colors.gray};
		}
	`,
);

// A passkey is typed blind, so it gets room and a centered, spaced line
const PasskeyInput = styled(
	Input,
	() => `
		padding: 12px 14px;
		font-size: 16px;
		text-align: center;
		letter-spacing: 0.15em;
	`,
);

const ErrorLine = styled(
	Component,
	({ colors }) => `
		min-height: 16px;
		font-size: 12px;
		text-align: center;
		color: ${colors.light(colors.danger)};
	`,
);

const LoginButton = styled(
	Button,
	({ colors }) => `
		width: 100%;
		padding: 11px;
		background-color: ${colors.dark(colors.green)};
		font-size: 14px;
		font-weight: 600;
	`,
);

export function mountLoginScreen(onSuccess) {
	const overlay = new LoginOverlay({ appendTo: document.body });

	const card = new LoginCard({ appendTo: overlay });

	new Masthead({
		appendTo: card,
		append: [
			new Icon({ addClass: 'logo', icon: 'wheat-awn' }),
			new Component({ addClass: 'name', textContent: 'Land Ledger' }),
			new Component({ addClass: 'hint', textContent: 'Enter your passkey to continue' }),
		],
	});

	const input = new PasskeyInput({
		appendTo: card,
		type: 'password',
		placeholder: 'Passkey',
		autocomplete: 'current-password',
	});

	const errorElem = new ErrorLine({ appendTo: card });

	const btn = new LoginButton({ appendTo: card, textContent: 'Continue' });

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
