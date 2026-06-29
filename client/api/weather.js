export const getWeather = async ({ lat, lng, start, end }) => {
	const params = new URLSearchParams({ lat: String(lat), lng: String(lng), start, end });
	const res = await fetch(`/weather?${params}`);

	if (!res.ok) return null;

	return res.json();
};
