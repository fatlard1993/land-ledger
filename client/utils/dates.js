import { parseDate } from '@vanilla-bean/components';

const DAY_MS = 86_400_000;

const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Calendar days between a date and today, counted from the start of each local day; rounding absorbs the 23 and 25 hour days of DST changes
export const daysAgo = (value, today = new Date()) =>
	Math.round((startOfDay(today) - startOfDay(parseDate(value) ?? new Date(NaN))) / DAY_MS);

// The library's relativeTime counts elapsed hours; a feeding is due by calendar day, so yesterday evening is "yesterday"
export const daysAgoLabel = (value, today) => {
	const days = daysAgo(value, today);

	if (days === 0) return 'today';
	if (days === 1) return 'yesterday';

	return `${days}d ago`;
};

// A day as YYYY-MM-DD where the reader is; toISOString gives the UTC day, which is tomorrow on a US evening
export const toDateOnly = (date = new Date()) =>
	[date.getFullYear(), date.getMonth() + 1, date.getDate()].map(n => String(n).padStart(2, '0')).join('-');
