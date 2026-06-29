export const toNum = v => (v !== '' && v != null ? Number(v) : null);

export const formatVal = v => {
	if (v == null || v === '') return '—';
	if (typeof v === 'boolean') return v ? 'Yes' : 'No';
	if (typeof v === 'object') return '[complex value]';
	const s = String(v);
	return s.length > 50 ? s.slice(0, 47) + '…' : s;
};

export const formatDollar = (n, decimals = 0) => {
	const v = Number(n) || 0;
	const abs = Math.abs(v).toLocaleString('en-US', {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	});
	return v < 0 ? `-$${abs}` : `$${abs}`;
};
