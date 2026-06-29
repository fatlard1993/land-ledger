import { GET, DELETE } from '@vanilla-bean/hypertether';

export const getPrecisionLayers = async options =>
	await GET('/precision-layers', { apiId: 'precision-layers', ...options });

export const getPrecisionLayerPoints = async id => {
	const res = await fetch(`/precision-layers/${id}/points`);
	if (!res.ok) return null;
	const data = await res.json();
	return data.points ?? null;
};

export const deletePrecisionLayer = async (id, options) =>
	await DELETE('/precision-layers/:id', { invalidates: ['precision-layers'], urlParameters: { id }, ...options });

export const analyzePrecisionLayers = async ({ appliedLayerId, yieldLayerId }) => {
	const res = await fetch('/precision-layers/analyze', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ appliedLayerId, yieldLayerId }),
	});
	if (!res.ok) throw new Error(await res.text());
	return res.json();
};
export const previewPrecisionFile = async file => {
	const form = new FormData();
	form.append('file', file);
	const res = await fetch('/precision-layers/preview', { method: 'POST', body: form });
	if (!res.ok) throw new Error(await res.text());
	return res.json();
};

export const importPrecisionLayer = async ({ file, fieldId, type, valueField, valueUnit, season, crop, label }) => {
	const form = new FormData();
	form.append('file', file);
	if (fieldId) form.append('fieldId', fieldId);
	if (type) form.append('type', type);
	if (valueField) form.append('valueField', valueField);
	if (valueUnit) form.append('valueUnit', valueUnit);
	if (season) form.append('season', String(season));
	if (crop) form.append('crop', crop);
	if (label) form.append('label', label);

	const res = await fetch('/precision-layers/import', { method: 'POST', body: form });
	if (!res.ok) throw new Error(await res.text());
	return res.json();
};
