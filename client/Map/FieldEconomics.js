import { Component, Elem, parseDate, SectionLabel, styled, theme } from '@vanilla-bean/components';

import { DetailRow } from '../Layout';
import parseDetails from '../utils/parseDetails';
import { formatDollar } from '../utils/format';

const { colors } = theme;

const Insight = styled(
	Component,
	({ colors, space }) => `
		padding: ${space.xs} 0;
		border-bottom: 1px solid ${colors.border};
		font-size: 11px;
		color: ${colors.muted};
	`,
);

// Renders the Economics and Derived Insights sections into `container`.
// Shows cost breakdown (seed, inputs, tillage, soil tests), revenue, net P/L,
// break-even analysis, cover-crop ROI, and organic-matter trend across all seasons.
// Returns immediately if there is no financial data for the most recent season.
export function renderEconomics(field, events, container) {
	const acreage = Number(field.acreage) || 0;
	const currentYear = new Date().getFullYear();

	const seasonYears = [...new Set(events.map(e => e.season || parseDate(e.date)?.getFullYear()).filter(Boolean))].sort(
		(a, b) => b - a,
	);

	const year = seasonYears[0] || currentYear;
	const seasonEvents = events.filter(e => (e.season || parseDate(e.date)?.getFullYear()) === year);

	const sumCostPerAcre = events =>
		events.reduce((sum, e) => {
			const costPerAc = Number(parseDetails(e.details).costPerAcre) || 0;
			return sum + (acreage ? costPerAc * acreage : costPerAc);
		}, 0);

	const inputEvents = seasonEvents.filter(e => e.category === 'input');
	const cropEvents = seasonEvents.filter(e => e.category === 'crop');
	const harvestEvents = seasonEvents.filter(e => e.category === 'harvest');
	const tillageEvents = seasonEvents.filter(e => e.category === 'tillage');
	const soilTestEvents = seasonEvents.filter(e => e.category === 'soil_test');

	const inputCost = sumCostPerAcre(inputEvents);
	const tillageCost = sumCostPerAcre(tillageEvents);
	const soilTestCost = soilTestEvents.reduce((sum, e) => sum + (Number(parseDetails(e.details).labCost) || 0), 0);
	const seedCost = cropEvents.reduce((sum, e) => {
		const d = parseDetails(e.details);
		const perAc = Number(d.seedCostPerAcre) || 0;
		return sum + (acreage ? perAc * acreage : perAc);
	}, 0);

	const totalCost = inputCost + tillageCost + soilTestCost + seedCost;
	const totalRevenue = harvestEvents.reduce((sum, e) => sum + (Number(parseDetails(e.details).revenue) || 0), 0);

	if (!totalCost && !totalRevenue) return;

	new SectionLabel({ appendTo: container, textContent: `Economics — ${year}` });

	const formatNum = n => formatDollar(n).replace('$', '');
	const perAc = v => (acreage ? ` ($${formatNum(v / acreage)}/ac)` : '');
	const rows = [];

	if (seedCost) rows.push(['🌱 Seed', `$${formatNum(seedCost)}${perAc(seedCost)}`, colors.light(colors.warning)]);
	if (inputCost) rows.push(['🧪 Inputs', `$${formatNum(inputCost)}${perAc(inputCost)}`, colors.light(colors.warning)]);
	if (tillageCost)
		rows.push(['🚜 Tillage', `$${formatNum(tillageCost)}${perAc(tillageCost)}`, colors.light(colors.warning)]);
	if (soilTestCost) rows.push(['🔬 Soil Tests', `$${formatNum(soilTestCost)}`, colors.light(colors.warning)]);
	if (totalCost) rows.push(['Total Costs', `$${formatNum(totalCost)}${perAc(totalCost)}`, colors.light(colors.orange)]);
	if (totalRevenue)
		rows.push(['Revenue', `$${formatNum(totalRevenue)}${perAc(totalRevenue)}`, colors.light(colors.success)]);

	if (totalCost && totalRevenue) {
		const net = totalRevenue - totalCost;
		const color = net >= 0 ? colors.light(colors.success) : colors.light(colors.danger);
		rows.push(['Net P/L', `${net >= 0 ? '+' : '-'}$${formatNum(Math.abs(net))}${perAc(Math.abs(net))}`, color]);
	}

	for (const [label, value, color] of rows) {
		const row = new DetailRow({ appendTo: container });
		new Elem({ tag: 'span', appendTo: row, addClass: 'label', textContent: label });
		new Elem({ tag: 'span', appendTo: row, addClass: 'value', style: { color }, textContent: value });
	}

	// ── Derived insights ────────────────────────────────────────────────────────

	const insights = [];

	for (const he of harvestEvents) {
		const d = parseDetails(he.details);
		const price = Number(d.pricePerUnit);
		const qty = Number(d.quantity);

		if (price > 0 && totalCost > 0) {
			const costPerAc = acreage ? totalCost / acreage : totalCost;
			const breakEven = costPerAc / price;
			const label = d.outputType || 'harvest';

			insights.push(`${label} break-even: ${breakEven.toFixed(1)} ${d.unit || 'units'}/ac @ $${price.toFixed(2)}`);

			if (qty > 0 && acreage > 0) {
				const qtyPerAc = qty / acreage;
				const margin = (qtyPerAc - breakEven) * price;

				if (Math.abs(margin) > 0.5) {
					insights.push(
						`Margin: ${qtyPerAc >= breakEven ? '+' : '-'}${Math.abs(qtyPerAc - breakEven).toFixed(1)} ${d.unit || 'units'}/ac ($${formatNum(Math.abs(margin))}/ac)`,
					);
				}
			}
		}
	}

	// Cover-crop ROI
	for (const cce of seasonEvents.filter(e => e.category === 'cover_crop')) {
		const d = parseDetails(cce.details);
		const ccSeed = Number(d.seedCostPerAcre) || 0;
		const ccApp = Number(d.applicationCostPerAcre) || 0;
		const totalCC = ccSeed + ccApp;
		const nCredit = Number(d.nCreditLbs) || 0;
		const nValue = nCredit * 0.6;

		if (totalCC > 0 || nValue > 0) {
			const roi = nValue - totalCC;
			const speciesName = Array.isArray(d.species)
				? d.species
						.map(s => s.name)
						.filter(Boolean)
						.join(', ') || 'Cover crop'
				: 'Cover crop';

			if (totalCC > 0) insights.push(`${speciesName}: $${formatNum(totalCC)}/ac cost`);
			if (nValue > 0) insights.push(`Est. N credit: ${nCredit} lbs/ac = $${nValue.toFixed(2)}/ac @ $0.60/lb N`);

			if (totalCC > 0 && nValue > 0) {
				const roiColor = roi >= 0 ? colors.light(colors.success) : colors.light(colors.danger);
				const coverRow = new DetailRow({ appendTo: container });
				new Elem({ tag: 'span', appendTo: coverRow, addClass: 'label', textContent: '🌿 CC ROI' });
				new Elem({
					tag: 'span',
					appendTo: coverRow,
					addClass: 'value',
					style: { color: roiColor },
					textContent: `${roi >= 0 ? '+' : ''}$${roi.toFixed(2)}/ac`,
				});
			}
		}
	}

	// OM% trend across all soil tests for this field
	const allSoilTests = events
		.filter(e => e.category === 'soil_test')
		.map(e => ({ date: parseDate(e.date), om: Number(parseDetails(e.details).organicMatter) }))
		.filter(e => e.om > 0)
		.sort((a, b) => a.date - b.date);

	if (allSoilTests.length >= 2) {
		const first = allSoilTests[0];
		const last = allSoilTests.at(-1);
		const delta = last.om - first.om;
		const years = (last.date - first.date) / (365.25 * 24 * 3600 * 1000);
		// OM is ~58% carbon; ~2M lbs soil/ac per 6" layer
		const tonsCPerAc = (delta * 0.58 * 20000) / 2000;

		insights.push(
			`OM: ${first.om}% → ${last.om}% over ${years.toFixed(1)} yrs (${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%)`,
		);
		if (Math.abs(tonsCPerAc) > 0.01) {
			insights.push(`Est. C seq: ${tonsCPerAc >= 0 ? '+' : ''}${tonsCPerAc.toFixed(2)} tons C/ac`);
		}
	}

	if (!insights.length) return;

	new SectionLabel({ appendTo: container, textContent: 'Derived Insights' });

	for (const insight of insights) {
		const row = new Insight({ appendTo: container });
		new Elem({ tag: 'span', appendTo: row, textContent: insight });
	}
}
