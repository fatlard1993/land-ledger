export const getAppSettings = async () => {
	const res = await fetch('/settings');

	if (!res.ok) return {};

	return res.json();
};

export const updateAppSettings = async data => {
	const res = await fetch('/settings', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data),
	});

	return res.ok;
};
