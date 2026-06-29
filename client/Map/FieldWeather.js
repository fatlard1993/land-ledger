import { Component, Elem } from '@vanilla-bean/components';

import { getWeather } from '../api';
import { centroidFromGeometry } from '../geo';

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

	const format = d => d.toISOString().slice(0, 10);
	const startStr = format(today);
	const endStr = format(end);

	let data;

	try {
		data = await getWeather({ lat: centroid.lat, lng: centroid.lon, start: startStr, end: endStr });
	} catch {
		return;
	}

	if (!data || !Object.keys(data).length) return;

	if (!container.elem.isConnected) return;

	const days = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));

	const wrap = new Component({
		appendTo: container,
		style: {
			display: 'grid',
			gridTemplateColumns: `repeat(${days.length}, 1fr)`,
			gap: '3px',
			marginBottom: '12px',
		},
	});

	for (const [date, day] of days) {
		const isToday = date === startStr;
		const d = new Date(`${date}T12:00:00`);
		const dayLabel = isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });

		const isHardFreeze = day.tempMin != null && day.tempMin <= 28;
		const isFrost = day.tempMin != null && day.tempMin <= 36 && !isHardFreeze;
		const isHeavyRain = (day.precipitation ?? 0) >= 0.75;

		let lowColor;
		if (isHardFreeze) lowColor = '#a855f7';
		else if (isFrost) lowColor = '#f97316';
		else lowColor = 'rgba(255,255,255,0.4)';

		let alertBg;
		if (isHardFreeze) alertBg = 'rgba(168,85,247,0.12)';
		else if (isFrost) alertBg = 'rgba(249,115,22,0.10)';
		else if (isHeavyRain) alertBg = 'rgba(29,78,216,0.12)';
		else alertBg = null;

		const cardBg = alertBg ?? (isToday ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)');

		let borderColor;
		if (isHardFreeze) borderColor = 'rgba(168,85,247,0.4)';
		else if (isFrost) borderColor = 'rgba(249,115,22,0.35)';
		else if (isToday) borderColor = 'rgba(255,255,255,0.14)';
		else borderColor = 'transparent';

		const card = new Component({
			appendTo: wrap,
			style: {
				background: cardBg,
				border: `1px solid ${borderColor}`,
				borderRadius: '6px',
				padding: '5px 2px',
				textAlign: 'center',
			},
		});

		new Elem({
			tag: 'div',
			appendTo: card,
			style: { fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.04em', color: 'rgba(255,255,255,0.4)' },
			textContent: dayLabel,
		});

		new Elem({
			tag: 'div',
			appendTo: card,
			style: { fontSize: '16px', lineHeight: '1.4' },
			textContent: weatherIcon(day.weatherCode, day.precipitation ?? 0),
		});

		if (day.tempMax != null) {
			new Elem({
				tag: 'div',
				appendTo: card,
				style: { fontSize: '12px', fontWeight: '600', color: '#fff' },
				textContent: `${Math.round(day.tempMax)}°`,
			});
		}

		if (day.tempMin != null) {
			new Elem({
				tag: 'div',
				appendTo: card,
				style: { fontSize: '11px', color: lowColor, fontWeight: isHardFreeze || isFrost ? '600' : '400' },
				textContent: `${Math.round(day.tempMin)}°`,
			});
		}

		if (day.precipitation != null && day.precipitation >= 0.01) {
			new Elem({
				tag: 'div',
				appendTo: card,
				style: {
					fontSize: '9px',
					color: isHeavyRain ? '#60a5fa' : '#5bc0eb',
					marginTop: '1px',
					fontWeight: isHeavyRain ? '600' : '400',
				},
				textContent: `${day.precipitation.toFixed(2)}"`,
			});
		}
	}
}
