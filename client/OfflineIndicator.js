import { Button, Component, styled, theme } from '@vanilla-bean/components';

const { colors } = theme;

const IndicatorBar = styled(
	Component,
	({ colors }) => `
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	z-index: 9999;
	font-size: 13px;
	font-family: inherit;
	text-align: center;
	padding: 6px 12px;
	user-select: none;
	letter-spacing: .02em;
	color: ${colors.white};
	transition: background 0.3s;
	display: none;

	&.visible {
		display: block;
	}
`,
);

export function mountOfflineIndicator() {
	const bar = new IndicatorBar({ prependTo: document.body });

	let pendingCount = 0;
	let hideTimer = null;

	const show = (text, bg) => {
		clearTimeout(hideTimer);
		bar.options.textContent = text;
		bar.options.style = { background: bg };
		bar.addClass('visible');
	};

	const hide = (delay = 0) => {
		clearTimeout(hideTimer);
		if (delay)
			hideTimer = setTimeout(() => {
				bar.removeClass('visible');
			}, delay);
		else bar.removeClass('visible');
	};

	const renderOffline = () => {
		const msg = pendingCount
			? `Offline — ${pendingCount} pending change${pendingCount !== 1 ? 's' : ''} will sync when reconnected`
			: 'Offline — viewing cached data  ·  changes cannot be saved';

		show(msg, colors.dark(colors.orange));
	};

	const onOnline = () => {
		if (!pendingCount) hide();
	};

	window.addEventListener('online', onOnline);
	window.addEventListener('offline', renderOffline);

	bar.addCleanup('network', () => {
		window.removeEventListener('online', onOnline);
		window.removeEventListener('offline', renderOffline);
	});

	// Show a "Refresh" prompt after a successful queue flush instead of auto-reloading,
	// so unsaved form state is never silently destroyed.
	window.addEventListener('land-ledger:queue-flushed', ({ detail: { synced } }) => {
		bar.elem.innerHTML = '';
		bar.elem.style.background = `${colors.dark(colors.green)}`;
		bar.elem.style.display = 'flex';
		bar.elem.style.alignItems = 'center';
		bar.elem.style.justifyContent = 'center';
		bar.elem.style.gap = '10px';

		const msg = document.createElement('span');
		msg.textContent = `Synced ${synced} change${synced !== 1 ? 's' : ''} — refresh to see updates`;
		bar.elem.appendChild(msg);

		new Button({
			appendTo: bar,
			variant: 'chip',
			textContent: 'Refresh',
			onPointerPress: () => window.location.reload(),
		});

		bar.addClass('visible');
	});

	// Returned callback is wired to initOfflineQueue in index.js
	return function onQueueState({ pending, syncing, synced }) {
		pendingCount = pending ?? 0;

		if (syncing) {
			show(`Syncing ${pending} change${pending !== 1 ? 's' : ''}…`, colors.dark(colors.blue));
			return;
		}

		if (synced != null && synced > 0) {
			show(`Synced ${synced} change${synced !== 1 ? 's' : ''}`, colors.dark(colors.green));
			hide(2000);
			return;
		}

		if (!navigator.onLine) {
			renderOffline();
		} else {
			hide();
		}
	};
}
