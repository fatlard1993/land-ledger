// Derive chart data from Events (not Seasons)

import { theme } from '@vanilla-bean/components';

import parseDetails from '../utils/parseDetails';

const { colors } = theme;

// One line per field, as hex: the charts add a two-digit alpha suffix for their fills
export const FIELD_COLORS = [
	colors.blue,
	colors.green,
	colors.yellow,
	colors.red,
	colors.light(colors.purple),
	colors.teal,
	colors.orange,
	colors.pink,
].map(color => color.toHexString());

// Returns { fieldId: [{year, timing, organicMatter, soilRespiration, pH, brayP, potassium, cec, nitrate}] }
export const soilDataByField = events => {
	const byField = {};

	for (const event of events) {
		if (event.category !== 'soil_test') continue;

		const d = parseDetails(event.details);

		if (!['organicMatter', 'soilRespiration', 'pH', 'brayP', 'potassium', 'cec', 'nitrate'].some(k => d[k] != null))
			continue;

		const year = event.season || (event.date ? new Date(event.date).getFullYear() : null);

		if (!year) continue;

		if (!byField[event.fieldId]) byField[event.fieldId] = [];

		const timing = d.timing || (event.name?.toLowerCase().includes('post') ? 'post-harvest' : 'pre-season');

		byField[event.fieldId].push({
			year,
			timing,
			organicMatter: d.organicMatter != null ? Number(d.organicMatter) : null,
			soilRespiration: d.soilRespiration != null ? Number(d.soilRespiration) : null,
			pH: d.pH != null ? Number(d.pH) : null,
			brayP: d.brayP != null ? Number(d.brayP) : null,
			potassium: d.potassium != null ? Number(d.potassium) : null,
			cec: d.cec != null ? Number(d.cec) : null,
			nitrate: d.nitrate != null ? Number(d.nitrate) : null,
		});
	}

	for (const id of Object.keys(byField)) byField[id].sort((a, b) => a.year - b.year);

	return byField;
};

// Returns { fieldId: [{year, yieldTotal, outputType, unit}] }
// Uses harvest events — yield is the total quantity harvested that season
export const yieldDataByField = events => {
	const byField = {};

	for (const event of events) {
		if (event.category !== 'harvest') continue;

		const d = parseDetails(event.details);

		if (d.quantity == null) continue;

		const year = event.season || (event.date ? new Date(event.date).getFullYear() : null);

		if (!year) continue;

		if (!byField[event.fieldId]) byField[event.fieldId] = [];

		byField[event.fieldId].push({
			year,
			yieldPerAcre: Number(d.quantity), // total for the season; label updated in chart
			crop: d.outputType || event.name || 'Harvest',
			unit: d.unit || 'units',
		});
	}

	for (const id of Object.keys(byField)) byField[id].sort((a, b) => a.year - b.year);

	return byField;
};

// Returns { fieldId: [{year, inputCost, revenue}] }
export const economicsByField = events => {
	const byField = {};

	for (const event of events) {
		const d = parseDetails(event.details);
		const year = event.season || (event.date ? new Date(event.date).getFullYear() : null);

		if (!year) continue;

		if (!byField[event.fieldId]) byField[event.fieldId] = {};
		if (!byField[event.fieldId][year]) byField[event.fieldId][year] = { year, inputCost: 0, revenue: 0 };

		if (event.category === 'input' && d.costPerAcre) byField[event.fieldId][year].inputCost += Number(d.costPerAcre);
		if (event.category === 'crop' && d.seedCostPerAcre)
			byField[event.fieldId][year].inputCost += Number(d.seedCostPerAcre);
		if (event.category === 'tillage' && d.costPerAcre) byField[event.fieldId][year].inputCost += Number(d.costPerAcre);
		if (event.category === 'harvest' && d.revenue) byField[event.fieldId][year].revenue += Number(d.revenue);
	}

	const result = {};

	for (const [fieldId, yearMap] of Object.entries(byField)) {
		result[fieldId] = Object.values(yearMap)
			.filter(y => y.inputCost || y.revenue)
			.sort((a, b) => a.year - b.year);
	}

	return result;
};

// Returns { fieldId: { year: {livestock, coverCrop} } }
export const practicesByFieldYear = events => {
	const data = {};

	for (const event of events) {
		const year = event.season || (event.date ? new Date(event.date).getFullYear() : null);

		if (!year) continue;

		if (!data[event.fieldId]) data[event.fieldId] = {};
		if (!data[event.fieldId][year]) data[event.fieldId][year] = {};

		if (event.category === 'livestock') data[event.fieldId][year].livestock = true;
		if (event.category === 'cover_crop') data[event.fieldId][year].coverCrop = true;
	}

	return data;
};

export const allYears = events =>
	[
		...new Set(
			events.map(event => event.season || (event.date ? new Date(event.date).getFullYear() : null)).filter(Boolean),
		),
	].sort((a, b) => a - b);
