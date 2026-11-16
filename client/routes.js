// Every view's path: the router, the nav and every link to a view build from these
export const ROUTES = Object.freeze({
	map: '/',
	fields: '/fields',
	leases: '/leases',
	supplies: '/supplies',
	timeline: '/timeline',
	financials: '/financials',
	todo: '/todo',
	incidents: '/incidents',
	maintenance: '/maintenance',
	feeding: '/feeding',
	applications: '/applications',
	animals: '/animals',
});

/**
 * Where Timeline opens filtered to one field (or building): the filter is in the address, so the link can be opened in
 * a new tab, bookmarked or shared
 * @param {string} [fieldId] - The field whose events it shows; none shows every field's
 * @returns {string} The hash
 */
export const timelineHref = fieldId => `#${ROUTES.timeline}${fieldId ? `?field=${encodeURIComponent(fieldId)}` : ''}`;

/**
 * The field a Timeline address is filtered to
 * @param {string} hash - A location hash
 * @returns {string|null} The field's id, or null for every field
 */
export const timelineFieldFrom = hash => new URLSearchParams(hash.split('?')[1] ?? '').get('field') || null;

/**
 * The hash a bookmark from before the paths were lowercase (#/Fields) now opens, or null when it isn't one.
 * @param {string} hash - A location hash
 * @returns {string|null} The hash of the view it names
 */
export const movedRoute = hash => {
	const [, path, rest] = hash.match(/^#(\/[^?]*)(.*)$/) ?? [];

	if (!path || path === path.toLowerCase() || !Object.values(ROUTES).includes(path.toLowerCase())) return null;

	return `#${path.toLowerCase()}${rest}`;
};
