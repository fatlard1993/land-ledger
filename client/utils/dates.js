const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

// A date-only value (2026-10-18) is a calendar day. new Date() reads it as UTC midnight, which is the evening before
// anywhere west of Greenwich, so it is built from its parts in local time instead
export const parseDate = value => {
	const day = typeof value === 'string' && value.match(DATE_ONLY);

	return day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
};

// A stored date as the user's locale writes it, or month/day when short; what a missing value shows as is `empty`, and
// a value that won't parse comes back as given
export const formatDate = (value, { empty = '', short = false } = {}) => {
	if (!value) return empty;

	const date = parseDate(value);

	if (isNaN(date)) return value;

	return short ? `${date.getMonth() + 1}/${date.getDate()}` : date.toLocaleDateString();
};

const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Calendar days between a date and today, counted from the start of each local day; rounding absorbs the 23 and 25 hour days of DST changes
export const daysAgo = (value, today = new Date()) =>
	Math.round((startOfDay(today) - startOfDay(parseDate(value))) / DAY_MS);

export const daysAgoLabel = (value, today) => {
	const days = daysAgo(value, today);

	if (days === 0) return 'today';
	if (days === 1) return 'yesterday';

	return `${days}d ago`;
};
