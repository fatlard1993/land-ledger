export const getReferenceFields = async ({ south, west, north, east }) => {
	const params = new URLSearchParams({ south, west, north, east });
	const response = await fetch(`/reference-fields?${params}`);

	if (!response.ok) throw new Error(`Reference fields fetch failed: ${response.status}`);

	return response.json();
};
