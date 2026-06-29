export const parseTabularFile = async file => {
	const formData = new FormData();

	formData.append('file', file);

	const res = await fetch('/import/tabular/parse', { method: 'POST', body: formData });

	if (!res.ok) {
		const msg = await res.text().catch(() => 'Parse failed');

		throw new Error(msg);
	}

	return res.json();
};

export const getImportTemplates = async () => {
	const res = await fetch('/import/tabular/templates');

	if (!res.ok) return [];

	return res.json();
};

export const saveImportTemplate = async ({ name, collection, mapping }) => {
	const res = await fetch('/import/tabular/templates', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name, collection, mapping }),
	});

	if (!res.ok) throw new Error(await res.text().catch(() => 'Save failed'));

	return res.json();
};

export const deleteImportTemplate = async name => {
	await fetch(`/import/tabular/templates/${encodeURIComponent(name)}`, { method: 'DELETE' });
};

export const applyTabularImport = async ({ collection, rows, mapping, defaults }) => {
	const res = await fetch('/import/tabular/apply', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ collection, rows, mapping, defaults }),
	});

	if (!res.ok) {
		const msg = await res.text().catch(() => 'Import failed');

		throw new Error(msg);
	}

	return res.json();
};
