import weatherDb from '../database/weather';
import requestMatch from '../utils/requestMatch';

// Dates older than this many days are served from the archive API (ERA5 reanalysis) and cached.
// More recent dates are always fetched fresh from the forecast API.
const ARCHIVE_CUTOFF_DAYS = 14;

const toDateStr = d => d.toISOString().slice(0, 10);

// Snap to the nearest ERA5 grid point (0.25° ≈ 27km).
// Weather data is spatially uniform at farm scale — every field on the same
// operation lands in the same grid cell and shares one cache entry.
const snapToGrid = (v, step = 0.25) => Math.round(v / step) * step;
const locationKey = (lat, lng) => `${snapToGrid(lat).toFixed(2)},${snapToGrid(lng).toFixed(2)}`;

const cutoffDate = () => {
	const d = new Date();

	d.setDate(d.getDate() - ARCHIVE_CUTOFF_DAYS);

	return toDateStr(d);
};

const dateRange = (start, end) => {
	const dates = [];
	// Use UTC noon to avoid DST edge cases when advancing by day
	const cur = new Date(`${start}T12:00:00Z`);
	const endDate = new Date(`${end}T12:00:00Z`);

	while (cur <= endDate) {
		dates.push(toDateStr(cur));
		cur.setUTCDate(cur.getUTCDate() + 1);
	}

	return dates;
};

const zipResponse = data => {
	const result = {};
	const dates = data?.daily?.time ?? [];

	for (let i = 0; i < dates.length; i++) {
		result[dates[i]] = {
			tempMax: data.daily.temperature_2m_max?.[i] ?? null,
			tempMin: data.daily.temperature_2m_min?.[i] ?? null,
			precipitation: data.daily.precipitation_sum?.[i] ?? null,
			windMax: data.daily.windspeed_10m_max?.[i] ?? null,
			weatherCode: data.daily.weathercode?.[i] ?? null,
		};
	}

	return result;
};

const DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode';
const UNITS = 'temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto';

async function fetchArchive(lat, lng, start, end) {
	const res = await fetch(
		`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${start}&end_date=${end}&daily=${DAILY}&${UNITS}`,
	);

	if (!res.ok) return {};

	return zipResponse(await res.json());
}

async function fetchForecast(lat, lng, start, end) {
	const res = await fetch(
		`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&start_date=${start}&end_date=${end}&daily=${DAILY}&${UNITS}`,
	);

	if (!res.ok) return {};

	return zipResponse(await res.json());
}

const weatherRouter = async request => {
	const match = requestMatch('GET', '/weather', request);

	if (!match) return;

	const { lat, lng, start, end } = match;

	if (!lat || !lng || !start || !end)
		return new Response('Missing required params: lat, lng, start, end', { status: 400 });

	const latN = parseFloat(lat);
	const lngN = parseFloat(lng);

	if (isNaN(latN) || isNaN(lngN)) return new Response('Invalid lat/lng', { status: 400 });

	// Validate dates and cap range to 2 years to prevent runaway iteration / SSRF
	const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
	if (!ISO_DATE.test(start) || !ISO_DATE.test(end))
		return new Response('start and end must be YYYY-MM-DD', { status: 400 });
	if (start > end) return new Response('start must be before end', { status: 400 });
	const MAX_RANGE_DAYS = 730;
	const startMs = new Date(`${start}T12:00:00Z`).getTime();
	const endMs = new Date(`${end}T12:00:00Z`).getTime();
	if ((endMs - startMs) / 86_400_000 > MAX_RANGE_DAYS)
		return new Response('Date range exceeds 2-year maximum', { status: 400 });

	const key = locationKey(latN, lngN);
	const cutoff = cutoffDate();
	const allDates = dateRange(start, end);

	const archiveDates = allDates.filter(d => d < cutoff);
	const forecastDates = allDates.filter(d => d >= cutoff);

	const result = {};

	if (archiveDates.length) {
		const missing = archiveDates.filter(d => !weatherDb.getDay(key, d));

		if (missing.length) {
			const fetched = await fetchArchive(latN, lngN, missing[0], missing.at(-1)).catch(() => ({}));

			if (Object.keys(fetched).length) await weatherDb.setDays(key, fetched);
		}

		for (const d of archiveDates) {
			const day = weatherDb.getDay(key, d);

			if (day) result[d] = day;
		}
	}

	if (forecastDates.length) {
		const fetched = await fetchForecast(latN, lngN, forecastDates[0], forecastDates.at(-1)).catch(() => ({}));

		Object.assign(result, fetched);
	}

	return Response.json(result);
};

export default weatherRouter;
