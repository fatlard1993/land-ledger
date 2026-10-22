import { Button, Card, Component, Elem, Icon, styled, theme } from '@vanilla-bean/components';
import { centroidFromGeometry } from './geo';
import { toDateOnly } from './utils/dates';

const { colors } = theme;

const DISMISSED_KEY = 'land-ledger-weather-dismissed';
const TODAY = toDateOnly();

// ── Alert definitions ──────────────────────────────────────────────────────────

const evaluate = (date, day) => {
	const alerts = [];

	if (day.tempMin != null && day.tempMin <= 28) {
		alerts.push({
			type: 'hard_freeze',
			icon: 'snowflake',
			color: colors.purple,
			label: `Hard Freeze — low ${Math.round(day.tempMin)}°F`,
		});
	} else if (day.tempMin != null && day.tempMin <= 36) {
		alerts.push({
			type: 'frost',
			icon: 'temperature-low',
			color: colors.orange,
			label: `Frost Warning — low ${Math.round(day.tempMin)}°F`,
		});
	}

	if (day.precipitation != null && day.precipitation >= 0.75) {
		alerts.push({
			type: 'rain',
			icon: 'cloud-showers-heavy',
			color: colors.blue,
			label: `Heavy Rain — ${day.precipitation.toFixed(2)}" forecast`,
		});
	}

	if (day.windMax != null && day.windMax >= 25) {
		alerts.push({
			type: 'wind',
			icon: 'wind',
			color: colors.gray,
			label: `High Wind — ${Math.round(day.windMax)} mph`,
		});
	}

	return alerts.map(a => ({
		...a,
		date,
		key: `${a.type}_${date}`,
		dayLabel: new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
		}),
	}));
};

// ── Dismissal — persisted in localStorage, keyed by event date ────────────────
// Keys are "${type}_${date}" (e.g. "frost_2026-06-05"). On load, prune any key
// whose event date is before today — those alerts have passed. This means:
// - Dismissals survive tab refreshes and long-running sessions.
// - Tomorrow's version of the same alert type always appears fresh.

const dateFromKey = k => k.slice(k.lastIndexOf('_') + 1);
const isCurrent = k => dateFromKey(k) >= TODAY;

const dismissed = new Set(
	(() => {
		try {
			return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]').filter(isCurrent);
		} catch {
			return [];
		}
	})(),
);

const dismiss = key => {
	dismissed.add(key);
	try {
		localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed].filter(isCurrent)));
	} catch {}
};

// ── Mount ─────────────────────────────────────────────────────────────────────

export async function mountWeatherAlerts() {
	// Fetch fields to compute a representative farm center point
	let fields;

	try {
		const res = await fetch('/fields');

		if (!res.ok) return;

		fields = Object.values(await res.json());
	} catch {
		return; // offline or pre-auth
	}

	const centroids = fields.map(f => centroidFromGeometry(f.geometry)).filter(Boolean);

	if (!centroids.length) return;

	const lat = centroids.reduce((s, c) => s + c.lat, 0) / centroids.length;
	const lon = centroids.reduce((s, c) => s + c.lon, 0) / centroids.length;

	// 5-day forecast from today
	const end = new Date();

	end.setDate(end.getDate() + 4);

	const endStr = toDateOnly(end);

	let forecast;

	try {
		const res = await fetch(`/weather?lat=${lat.toFixed(4)}&lng=${lon.toFixed(4)}&start=${TODAY}&end=${endStr}`);

		if (!res.ok) return;

		forecast = await res.json();
	} catch {
		return;
	}

	// Collect and filter alerts
	const allAlerts = Object.entries(forecast)
		.filter(([date]) => date >= TODAY)
		.flatMap(([date, day]) => evaluate(date, day))
		.filter(a => !dismissed.has(a.key));

	if (!allAlerts.length) return;

	render(allAlerts);
}

// ── Styled components ─────────────────────────────────────────────────────────

const AlertContainer = styled(
	Component,
	() => `
	position: fixed;
	bottom: 72px;
	right: 12px;
	z-index: 9000;
	display: flex;
	flex-direction: column;
	gap: 6px;
	max-width: 290px;
	pointer-events: none;
`,
);

// Floats over the map, so it's opaque where a Card on the page is translucent
const AlertCard = styled(
	Card,
	({ colors }) => `
		pointer-events: auto;
		display: flex;
		align-items: center;
		gap: 8px;
		background-color: ${colors.alpha(colors.black, 0.95)};
		padding: 8px 10px;
		font-size: 12px;
		color: ${colors.white};
		box-shadow: 0 2px 8px ${colors.alpha(colors.vantablack, 0.4)};
		transition: opacity 0.2s;

		& .when {
			margin-top: 1px;
			font-size: 11px;
			color: ${colors.gray};
		}
	`,
);

// ── Render ────────────────────────────────────────────────────────────────────

function render(alerts) {
	const container = new AlertContainer({ appendTo: document.body });

	for (const alert of alerts) addAlertCard(container, alert);
}

function addAlertCard(container, alert) {
	const card = new AlertCard({ appendTo: container, accent: alert.color });

	new Icon({
		tag: 'span',
		appendTo: card,
		style: { fontSize: '16px', flexShrink: '0', color: alert.color },
		icon: alert.icon,
	});

	const body = new Component({
		appendTo: card,
		style: { flex: '1', minWidth: '0' },
	});

	new Elem({
		tag: 'div',
		appendTo: body,
		style: { fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
		textContent: alert.label,
	});

	new Elem({
		tag: 'div',
		appendTo: body,
		addClass: 'when',
		textContent: alert.dayLabel,
	});

	new Button({
		appendTo: card,
		variant: 'flat',
		icon: 'xmark',
		title: 'Dismiss',
		style: { flexShrink: '0' },
		onPointerPress: () => {
			dismiss(alert.key);
			card.options.style = { opacity: '0' };
			setTimeout(() => card.destroy(), 200);
		},
	});
}
