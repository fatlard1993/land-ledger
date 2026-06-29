export const getCountyYield = async ({ state, county, crop, year }) => {
	if (!state || !county || !crop || !year) return null;

	const params = new URLSearchParams({ state, county, crop, year: String(year) });
	const res = await fetch(`/benchmarks/county-yield?${params}`);

	if (!res.ok) return null;

	const data = await res.json();
	return data.error ? null : data;
};
