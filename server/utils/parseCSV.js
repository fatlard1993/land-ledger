// Minimal RFC 4180 CSV parser — handles quoted fields, embedded commas, escaped quotes ("").
// Does not handle multi-line quoted fields (RFC 4180 allows it, but farm export files never use it).
export default function parseCSV(text) {
	const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	const rows = [];

	for (const rawLine of normalised.split('\n')) {
		const line = rawLine.trim();
		if (!line) continue;

		const row = [];
		let field = '';
		let inQuotes = false;

		for (let i = 0; i < line.length; i++) {
			const ch = line[i];

			if (inQuotes) {
				if (ch === '"' && line[i + 1] === '"') {
					field += '"';
					i++;
				} else if (ch === '"') inQuotes = false;
				else field += ch;
			} else if (ch === '"') {
				inQuotes = true;
			} else if (ch === ',') {
				row.push(field.trim());
				field = '';
			} else {
				field += ch;
			}
		}

		row.push(field.trim());
		rows.push(row);
	}

	return rows;
}
