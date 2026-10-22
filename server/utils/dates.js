import { parseDate } from '@vanilla-bean/components/utils/date';

// "Today" is the server's local day: the server is the farm's own machine, set to the farm's zone, and requests
// don't say where their reader is. toISOString gives the UTC day instead, which is tomorrow on a US evening.
export const toDateOnly = (date = new Date()) =>
	[date.getFullYear(), date.getMonth() + 1, date.getDate()].map(n => String(n).padStart(2, '0')).join('-');

// Calendar days, so the 23 and 25 hour days of DST changes are still one day each
export const addDays = (value, days) => {
	const date = parseDate(value);

	date.setDate(date.getDate() + days);

	return toDateOnly(date);
};
