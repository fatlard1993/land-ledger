import { Component, styled } from '@vanilla-bean/components';

import { getWeather } from '../api';
import { centroidFromGeometry } from '../geo';
import { toDateOnly } from '../utils/dates';

const Strip = styled(
	Component,
	() => `
		display: grid;
		gap: 3px;
		margin-bottom: 12px;
	`,
);

// A day's tint says what to watch for: a hard freeze, a frost, or heavy rain
const DayCard = styled(
	Component,
	({ colors, radius }) => `
		padding: 5px 2px;
		border: 1px solid transparent;
		border-radius: ${radius.md};
		background: ${colors.alpha(colors.white, 0.04)};
		text-align: center;

		&.today {
			background: ${colors.alpha(colors.white, 0.08)};
			border-color: ${colors.border};
		}

		&.freeze {
			background: ${colors.alpha(colors.purple, 0.15)};
			border-color: ${colors.alpha(colors.light(colors.purple), 0.4)};
		}

		&.frost {
			background: ${colors.alpha(colors.orange, 0.1)};
			border-color: ${colors.alpha(colors.orange, 0.35)};
		}

		&.rain {
			background: ${colors.alpha(colors.blue, 0.12)};
		}
	`,
);

const DayLabel = styled(
	Component,
	({ colors }) => `
		font-size: 9px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: ${colors.gray};
	`,
);

const High = styled(
	Component,
	({ colors }) => `
		font-size: 12px;
		font-weight: 600;
		color: ${colors.white};
	`,
);

const Low = styled(
	Component,
	({ colors }) => `
		font-size: 11px;
		color: ${colors.gray};

		.freeze > & {
			font-weight: 600;
			color: ${colors.light(colors.purple)};
		}

		.frost > & {
			font-weight: 600;
			color: ${colors.light(colors.orange)};
		}
	`,
);

const Rain = styled(
	Component,
	({ colors }) => `
		margin-top: 1px;
		font-size: 9px;
		color: ${colors.light(colors.blue)};

		.rain > & {
			font-weight: 600;
			color: ${colors.lighter(colors.blue)};
		}
	`,
);

// WMO weather interpretation code → display emoji
export function weatherIcon(code, precipitation) {
	if (code == null) return precipitation > 0 ? '🌧️' : '☀️';
	if (code === 0) return '☀️';
	if (code <= 3) return '⛅';
	if (code <= 48) return '🌫️';
	if (code <= 67) return '🌧️';
	if (code <= 77) return '❄️';
	if (code <= 82) return '🌦️';
	if (code <= 86) return '❄️';
	return '⛈️';
}

// Renders a 7-day forecast strip into `container`.
// Fires async — doesn't block the panel; if `container` is detached before
// the fetch resolves the result is silently discarded.
export async function renderWeatherStrip(field, container) {
	const centroid = centroidFromGeometry(field.geometry);

	if (!centroid) return;

	const today = new Date();
	const end = new Date(today);

	end.setDate(end.getDate() + 6);

	const startStr = toDateOnly(today);
	const endStr = toDateOnly(end);

	let data;

	try {
		data = await getWeather({ lat: centroid.lat, lng: centroid.lon, start: startStr, end: endStr });
	} catch {
		return;
	}

	if (!data || !Object.keys(data).length) return;

	if (!container.elem.isConnected) return;

	const days = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));

	const wrap = new Strip({ appendTo: container, style: { gridTemplateColumns: `repeat(${days.length}, 1fr)` } });

	for (const [date, day] of days) {
		const isToday = date === startStr;
		const d = new Date(`${date}T12:00:00`);
		const dayLabel = isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });

		const isHardFreeze = day.tempMin != null && day.tempMin <= 28;
		const isFrost = day.tempMin != null && day.tempMin <= 36 && !isHardFreeze;
		const isHeavyRain = (day.precipitation ?? 0) >= 0.75;

		let alert = null;
		if (isHardFreeze) alert = 'freeze';
		else if (isFrost) alert = 'frost';
		else if (isHeavyRain) alert = 'rain';

		const card = new DayCard({ appendTo: wrap });

		card.toggleClass('today', isToday);
		if (alert) card.addClass(alert);

		new DayLabel({ appendTo: card, textContent: dayLabel });

		new Component({
			appendTo: card,
			style: { fontSize: '16px', lineHeight: '1.4' },
			textContent: weatherIcon(day.weatherCode, day.precipitation ?? 0),
		});

		if (day.tempMax != null) new High({ appendTo: card, textContent: `${Math.round(day.tempMax)}°` });

		if (day.tempMin != null) new Low({ appendTo: card, textContent: `${Math.round(day.tempMin)}°` });

		if (day.precipitation != null && day.precipitation >= 0.01) {
			new Rain({ appendTo: card, textContent: `${day.precipitation.toFixed(2)}"` });
		}
	}
}
