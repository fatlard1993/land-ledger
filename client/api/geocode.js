export const searchLocation = async query => {
	const res = await fetch(`/geocode?q=${encodeURIComponent(query)}`);

	if (!res.ok) throw new Error('Geocode failed');

	return res.json();
};

export const reverseGeocode = async (lat, lon) => {
	const res = await fetch(`/geocode/reverse?lat=${lat}&lon=${lon}`);

	if (!res.ok) return { county: '', state: '' };

	return res.json();
};
