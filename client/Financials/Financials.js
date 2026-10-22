import {
	Card,
	Component,
	Elem,
	EmptyState,
	parseDate,
	SectionLabel,
	Select,
	styled,
	theme,
	Toolbar,
} from '@vanilla-bean/components';

import AsyncView from '../AsyncView';

import {
	getRevenue,
	getEvents,
	getFields,
	getEquipment,
	getMaintenance,
	getLoans,
	getBudgetItems,
	getSupplies,
	getFeedingLogs,
	getFeedingSchedules,
	getLeases,
} from '../api';
import { annualAmount, FREQUENCIES } from '../Budget/BudgetItemDialog';
import parseDetails from '../utils/parseDetails';
import { formatDollar } from '../utils/format';
import { PageView } from '../Layout';
import { toSqm, convertArea } from '../geo';
import { economicsByField } from '../Charts/chartData';

const formatMoney = n => {
	const abs = Math.abs(n);
	const str = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(0)}`;

	return n < 0 ? `-${str}` : str;
};

const { colors, radius, space } = theme;

// Gains read green, losses red, nothing at all quiet
const signColor = n => {
	if (n > 0) return colors.light(colors.success);
	if (n < 0) return colors.light(colors.danger);

	return colors.gray;
};

const CardLabel = styled(SectionLabel, ({ space }) => `margin: 0 0 ${space.md};`);

const BarRow = styled(
	Component,
	({ space }) => `
		display: flex;
		align-items: center;
		gap: ${space.sm};
		margin-bottom: ${space.sm};
	`,
);

const BarLabel = styled(
	Component,
	({ colors }) => `
		flex: 0 1 160px;
		min-width: 0;
		overflow: hidden;
		font-size: 12px;
		color: ${colors.muted};
		text-overflow: ellipsis;
		white-space: nowrap;
	`,
	{ tag: 'span' },
);

const Track = styled(
	Component,
	({ colors, radius }) => `
		flex: 1;
		height: 6px;
		overflow: hidden;
		border-radius: ${radius.sm};
		background: ${colors.alpha(colors.white, 0.05)};

		&.thin {
			flex: none;
			height: 5px;
			border-radius: 2px;
		}

		& > div {
			height: 100%;
			border-radius: inherit;
			transition: width 0.3s;
		}
	`,
);

const Amount = styled(
	Component,
	() => `
		flex-shrink: 0;
		width: 52px;
		font-size: 12px;
		text-align: right;
	`,
	{ tag: 'span' },
);

// A label and its amount, at either end of a line
const AmountRow = styled(
	Component,
	({ colors, space }) => `
		display: flex;
		justify-content: space-between;
		gap: ${space.sm};
		padding: ${space.xs} 0;
		font-size: 12px;

		& > :first-child {
			color: ${colors.gray};
		}
	`,
);

const Note = styled(
	Component,
	({ colors, space }) => `
		margin-top: ${space.sm};
		font-size: 10px;
		color: ${colors.gray};
	`,
);

// Tables wider than a phone scroll inside their card instead of widening the page
const TableScroll = styled(
	Component,
	() => `
		overflow-x: auto;

		& > * {
			min-width: 460px;
		}
	`,
);

const GridRow = styled(
	Component,
	({ colors, space }) => `
		display: grid;
		align-items: center;
		gap: ${space.sm};
		padding: ${space.sm} 0;
		border-bottom: 1px solid ${colors.border};

		&.head {
			padding: ${space.xs} 0 ${space.sm};
			font-size: 10px;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: ${colors.gray};
		}
	`,
);

const RowName = styled(
	Component,
	({ colors }) => `
		overflow: hidden;
		font-size: 13px;
		font-weight: 600;
		color: ${colors.white};
		text-overflow: ellipsis;
		white-space: nowrap;
	`,
);

const Bar = ({ appendTo, label, amount, total, color }) => {
	const pct = total > 0 ? Math.max(2, (amount / total) * 100) : 0;
	const row = new BarRow({ appendTo });

	new BarLabel({ appendTo: row, textContent: label });

	const track = new Track({ appendTo: row });

	new Elem({ tag: 'div', appendTo: track, style: { width: `${pct}%`, background: color } });
	new Amount({
		appendTo: row,
		style: { color: colors.light(color), fontWeight: '600' },
		textContent: formatMoney(amount),
	});
};

const YEAR = new Date().getFullYear();

export default class Financials extends AsyncView {
	_buildView() {
		this.toolbar = new Toolbar({ appendTo: this, variant: 'bar', heading: 'Financials', gap: 8, wrap: false });

		const yearSelect = new Select({
			appendTo: this.toolbar,
			options: [YEAR, YEAR - 1, YEAR - 2].map(y => ({ label: String(y), value: String(y) })),
			value: String(YEAR),
			style: { width: 'auto' },
		});

		this.content = new PageView({ appendTo: this });
		this._year = YEAR;
		yearSelect.elem.addEventListener('change', () => {
			this._year = Number(yearSelect.elem.value);
			this._render();
		});
	}

	_datasources() {
		return {
			_rev: getRevenue,
			_events: getEvents,
			_fields: getFields,
			_equipment: getEquipment,
			_maintenance: getMaintenance,
			_loans: getLoans,
			_budget: getBudgetItems,
			_supplies: getSupplies,
			_feedingLogs: getFeedingLogs,
			_feedingSchedules: getFeedingSchedules,
			_leases: getLeases,
		};
	}

	_onData() {
		this._render();
	}

	_render() {
		this.content.empty();

		const yr = this._year;
		const now = new Date();
		const isThisYear = yr === now.getFullYear();
		const lastMonth = isThisYear ? now.getMonth() : 11; // 0-indexed
		const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

		// Only count entries with a date in the selected year — no projections
		const eventDate = e => (e.date ? parseDate(e.date) : null);
		const inYear = d => d && d.getFullYear() === yr;

		const fieldList = Object.values(this._fields?.body || {});

		// ── Build monthly buckets ─────────────────────────────────────────────────
		const byMonth = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));

		// Revenue table entries (building income, equipment hire, inventory sales)
		for (const r of Object.values(this._rev?.body || {})) {
			const d = r.date ? parseDate(r.date) : null;

			if (!inYear(d)) continue;

			byMonth[d.getMonth()].income += Number(r.amount) || 0;
		}

		// Harvest revenue from events
		for (const e of Object.values(this._events?.body || {})) {
			const d = eventDate(e);

			if (!inYear(d)) continue;

			const eventDetails = parseDetails(e.details);

			if (e.category === 'harvest') byMonth[d.getMonth()].income += Number(eventDetails.revenue) || 0;

			// Expenses
			const ac = this._acreageFor(e.fieldId);

			if (e.category === 'input') byMonth[d.getMonth()].expense += (Number(eventDetails.costPerAcre) || 0) * ac;
			if (e.category === 'crop') byMonth[d.getMonth()].expense += (Number(eventDetails.seedCostPerAcre) || 0) * ac;
			if (e.category === 'tillage') byMonth[d.getMonth()].expense += (Number(eventDetails.costPerAcre) || 0) * ac;
			if (e.category === 'soil_test') byMonth[d.getMonth()].expense += Number(eventDetails.labCost) || 0;
		}

		// Maintenance costs
		for (const m of Object.values(this._maintenance?.body || {})) {
			const d = m.date ? parseDate(m.date) : null;

			if (!inYear(d)) continue;

			byMonth[d.getMonth()].expense += Number(m.cost) || 0;
		}

		// Feeding costs — logs × supply cost per unit
		const scheduleMap = Object.values(this._feedingSchedules?.body || {}).reduce((m, s) => {
			m[s.id] = s;
			return m;
		}, {});
		const supplyMap = Object.values(this._supplies?.body || {}).reduce((m, s) => {
			m[s.id] = s;
			return m;
		}, {});

		for (const log of Object.values(this._feedingLogs?.body || {})) {
			const d = log.date ? parseDate(log.date) : null;

			if (!inYear(d)) continue;

			const schedule = log.scheduleId ? scheduleMap[log.scheduleId] : null;
			const supply = schedule?.supplyId ? supplyMap[schedule.supplyId] : null;

			if (!supply?.costPerUnit) continue;

			const qty = (Number(log.amountPerHead) || 0) * Math.max(1, Number(log.headCount) || 1);
			const cost = qty * Number(supply.costPerUnit);

			if (cost > 0) byMonth[d.getMonth()].expense += cost;
		}

		// Cash rent paid this year (tenant leases) — part of the operation's true expense
		const tenantLeases = Object.values(this._leases?.body || {}).filter(l => l.role === 'tenant');
		const totalRent = tenantLeases.reduce((s, l) => s + (Number(l.rateAmount) || 0), 0);

		// Totals — only up through last month with data (not projected)
		const totalRevenue = byMonth.slice(0, lastMonth + 1).reduce((s, m) => s + m.income, 0);
		const totalExpenses = byMonth.slice(0, lastMonth + 1).reduce((s, m) => s + m.expense, 0) + totalRent;

		// ── Net Worth snapshot ───────────────────────────────────────────────────────
		const inventoryValue = Object.values(this._supplies?.body || {}).reduce(
			(s, sup) => s + (Number(sup.currentStock) || 0) * (Number(sup.costPerUnit) || 0),
			0,
		);

		const equipmentAppraisedValue = Object.values(this._equipment?.body || {})
			.filter(e => e.tenure !== 'lease')
			.reduce((s, e) => s + (Number(e.appraisalValue) || 0), 0);

		const loans = Object.values(this._loans?.body || {});
		const outstandingLoans = loans.reduce((s, l) => s + (Number(l.currentBalance || l.loanAmount) || 0), 0);
		const appraisedAssets = loans.reduce((s, l) => s + (Number(l.assetAppraisalValue) || 0), 0);

		// Equity per loan for display
		const loanEquity = loans
			.filter(l => l.assetAppraisalValue)
			.map(l => ({
				name: l.entityName || l.lender || 'Loan',
				appraisal: Number(l.assetAppraisalValue),
				balance: Number(l.currentBalance || l.loanAmount) || 0,
				equity: Number(l.assetAppraisalValue) - (Number(l.currentBalance || l.loanAmount) || 0),
				ltv: (((Number(l.currentBalance || l.loanAmount) || 0) / Number(l.assetAppraisalValue)) * 100).toFixed(1),
			}));

		if (inventoryValue > 0 || outstandingLoans > 0 || appraisedAssets > 0 || equipmentAppraisedValue > 0) {
			const nwCard = new Card({ appendTo: this.content });
			const nwHeader = new Component({
				appendTo: nwCard,
				style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.sm },
			});

			new CardLabel({ appendTo: nwHeader, style: { margin: '0' }, textContent: 'Net Worth Snapshot' });

			const nw = inventoryValue + appraisedAssets + equipmentAppraisedValue - outstandingLoans;
			const nwColor = nw >= 0 ? colors.light(colors.success) : colors.light(colors.danger);

			new Elem({
				tag: 'div',
				appendTo: nwHeader,
				style: { fontSize: '18px', fontWeight: '700', color: nwColor },
				textContent: formatDollar(nw),
			});

			const nwRows = [
				inventoryValue > 0 ? ['📦 Supplies inventory', inventoryValue] : null,
				equipmentAppraisedValue > 0 ? ['🚜 Equipment (appraised)', equipmentAppraisedValue] : null,
				appraisedAssets > 0 ? ['🏠 Property (appraised)', appraisedAssets] : null,
				outstandingLoans > 0 ? ['🏦 Outstanding loans', -outstandingLoans] : null,
			].filter(Boolean);

			for (const [label, amount] of nwRows) {
				const row = new AmountRow({ appendTo: nwCard });

				new Elem({ tag: 'span', appendTo: row, textContent: label });
				new Elem({ tag: 'span', appendTo: row, style: { color: signColor(amount) } }).elem.textContent =
					`${amount >= 0 ? '+' : ''}${formatDollar(Math.abs(amount))}`;
			}

			// Per-loan equity breakdown
			if (loanEquity.length) {
				new SectionLabel({
					appendTo: nwCard,
					style: { margin: `${space.sm} 0 ${space.xs}`, paddingTop: space.sm, borderTop: `1px solid ${colors.border}` },
					textContent: 'Equity by Asset',
				});

				for (const l of loanEquity) {
					const eqColor = l.equity >= 0 ? colors.light(colors.success) : colors.light(colors.danger);
					const row = new AmountRow({ appendTo: nwCard });

					new Elem({ tag: 'span', appendTo: row, textContent: `${l.name} (${l.ltv}% LTV)` });
					new Elem({ tag: 'span', appendTo: row, style: { color: eqColor, fontWeight: '600' } }).elem.textContent =
						`${formatDollar(l.equity)} equity`;
				}
			}
		}

		// ── Recurring budget items (always shown when present) ───────────────────
		this._renderBudgetCard(yr, lastMonth, MONTHS);

		if (totalRevenue === 0 && totalExpenses === 0) {
			new EmptyState({ appendTo: this.content, icon: 'sack-dollar', title: `No transactions recorded for ${yr}` });

			return;
		}

		// ── Monthly grid ──────────────────────────────────────────────────────────
		const monthCard = new Card({ appendTo: this.content });
		const monthHeader = new Component({
			appendTo: monthCard,
			style: { display: 'flex', justifyContent: 'space-between', marginBottom: space.sm },
		});

		new CardLabel({
			appendTo: monthHeader,
			style: { margin: '0' },
			textContent: `Monthly — ${yr}${isThisYear ? ` (through ${MONTHS[lastMonth]})` : ''}`,
		});

		const monthsWithData = MONTHS.map((name, i) => ({ name, i, ...byMonth[i] })).filter(
			m => m.i <= lastMonth && (m.income || m.expense),
		);

		if (!monthsWithData.length) {
			new Elem({
				tag: 'div',
				appendTo: monthCard,
				style: { fontSize: '12px', color: colors.gray },
				textContent: 'No recorded transactions yet',
			});
		} else {
			const maxVal = Math.max(...monthsWithData.map(m => Math.max(m.income, m.expense)), 1);

			for (const m of monthsWithData) {
				const mRow = new Component({
					appendTo: monthCard,
					style: { display: 'flex', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
				});

				new Elem({
					tag: 'span',
					appendTo: mRow,
					style: { fontSize: '11px', color: colors.gray, width: '26px', flexShrink: '0' },
					textContent: m.name,
				});

				const barArea = new Component({
					appendTo: mRow,
					style: { flex: '1', display: 'flex', flexDirection: 'column', gap: space.xs },
				});

				if (m.income) {
					const incTrack = new Track({ appendTo: barArea, addClass: 'thin' });

					new Elem({
						tag: 'div',
						appendTo: incTrack,
						style: { width: `${(m.income / maxVal) * 100}%`, background: colors.success },
					});
				}

				if (m.expense) {
					const expTrack = new Track({ appendTo: barArea, addClass: 'thin' });

					new Elem({
						tag: 'div',
						appendTo: expTrack,
						style: { width: `${(m.expense / maxVal) * 100}%`, background: colors.warning },
					});
				}

				const net = m.income - m.expense;

				new Amount({
					appendTo: mRow,
					style: { fontSize: '11px', color: signColor(net) },
					textContent: net !== 0 ? formatMoney(net) : '—',
				});
			}

			// Legend
			const legend = new Component({
				appendTo: monthCard,
				style: { display: 'flex', gap: space.md, marginTop: space.sm },
			});

			[
				[colors.success, 'Income'],
				[colors.warning, 'Expense'],
			].forEach(([color, label]) => {
				const item = new Component({
					appendTo: legend,
					style: { display: 'flex', alignItems: 'center', gap: space.xs },
				});

				new Elem({
					tag: 'div',
					appendTo: item,
					style: { width: '10px', height: '4px', background: color, borderRadius: '2px' },
				});
				new Elem({
					tag: 'span',
					appendTo: item,
					style: { fontSize: '10px', color: colors.gray },
					textContent: label,
				});
			});
		}

		// ── Income breakdown ──────────────────────────────────────────────────────
		if (totalRevenue > 0) {
			const incCard = new Card({ appendTo: this.content });

			new CardLabel({ appendTo: incCard, textContent: 'Income Sources' });

			// Tally recorded revenue by type + harvest events
			const incByType = new Map();

			for (const r of Object.values(this._rev?.body || {})) {
				const d = r.date ? parseDate(r.date) : null;

				if (!inYear(d)) continue;

				const k = r.type || 'Other';

				incByType.set(k, (incByType.get(k) || 0) + (Number(r.amount) || 0));
			}

			const harvestRev = Object.values(this._events?.body || {})
				.filter(e => e.category === 'harvest' && inYear(eventDate(e)))
				.reduce((s, e) => s + (Number(parseDetails(e.details).revenue) || 0), 0);

			const incSources = [
				{ label: '🌾 Harvest sales', amount: harvestRev },
				...[...incByType.entries()].map(([k, v]) => ({ label: `💰 ${k}`, amount: v })),
			]
				.filter(s => s.amount > 0)
				.sort((a, b) => b.amount - a.amount);

			for (const s of incSources) Bar({ appendTo: incCard, ...s, total: totalRevenue, color: colors.success });
		}

		// ── Expense breakdown ─────────────────────────────────────────────────────
		if (totalExpenses > 0) {
			const expCard = new Card({ appendTo: this.content });

			new CardLabel({ appendTo: expCard, textContent: 'Where It Went' });

			const expByType = new Map();

			for (const e of Object.values(this._events?.body || {})) {
				const d = eventDate(e);

				if (!inYear(d)) continue;

				const eventDetails = parseDetails(e.details);
				const ac = this._acreageFor(e.fieldId);
				const labels = { input: '🧪 Inputs', crop: '🌱 Seed', tillage: '🚜 Tillage', soil_test: '🔬 Soil testing' };
				const costs = {
					input: (Number(eventDetails.costPerAcre) || 0) * ac,
					crop: (Number(eventDetails.seedCostPerAcre) || 0) * ac,
					tillage: (Number(eventDetails.costPerAcre) || 0) * ac,
					soil_test: Number(eventDetails.labCost) || 0,
				};
				const cost = costs[e.category] || 0;

				if (cost > 0) expByType.set(labels[e.category] || e.category, (expByType.get(labels[e.category]) || 0) + cost);
			}

			const maintenanceTotal = Object.values(this._maintenance?.body || {})
				.filter(m => inYear(m.date ? parseDate(m.date) : null))
				.reduce((s, m) => s + (Number(m.cost) || 0), 0);

			if (maintenanceTotal > 0) expByType.set('🔧 Maintenance', maintenanceTotal);

			// Feeding costs
			const feedTotal = Object.values(this._feedingLogs?.body || {})
				.filter(l => inYear(l.date ? parseDate(l.date) : null))
				.reduce((s, log) => {
					const schedule = log.scheduleId ? scheduleMap[log.scheduleId] : null;
					const supply = schedule?.supplyId ? supplyMap[schedule.supplyId] : null;

					if (!supply?.costPerUnit) return s;

					return (
						s + (Number(log.amountPerHead) || 0) * Math.max(1, Number(log.headCount) || 1) * Number(supply.costPerUnit)
					);
				}, 0);

			if (feedTotal > 0) expByType.set('🐄 Feeding', feedTotal);
			if (totalRent > 0) expByType.set('📝 Cash rent', totalRent);

			const expSources = [...expByType.entries()]
				.map(([k, v]) => ({ label: k, amount: v }))
				.sort((a, b) => b.amount - a.amount);

			for (const s of expSources) Bar({ appendTo: expCard, ...s, total: totalExpenses, color: colors.warning });
		}

		// ── Cross-field comparison ────────────────────────────────────────────────
		// Per-field rent: sum of tenant lease rateAmounts where entityId matches
		const rentByField = {};
		for (const l of tenantLeases) {
			if (l.entityType === 'field' && l.entityId) {
				rentByField[l.entityId] = (rentByField[l.entityId] || 0) + (Number(l.rateAmount) || 0);
			}
		}

		// Multi-year economics from events (all years, for YoY delta and season grid)
		const allEvents = Object.values(this._events?.body || {});
		const econByField = economicsByField(allEvents); // { fieldId: [{ year, inputCost, revenue }] }

		const fieldRows = fieldList
			.map(field => {
				const ac = this._acreageFor(field.id);
				const fieldEconAllYears = econByField[field.id] || [];

				const forYear = fieldEconAllYears.find(d => d.year === yr);
				const forPrior = fieldEconAllYears.find(d => d.year === yr - 1);

				const revenue = forYear?.revenue || 0;
				const costs = forYear ? forYear.inputCost * ac : 0;
				const rent = rentByField[field.id] || 0;
				const net = revenue - costs - rent;
				const netPrior = forPrior ? forPrior.revenue - forPrior.inputCost * ac - rent : null;
				const perAcre = ac > 0 ? net / ac : null;

				return { field, ac, revenue, costs, rent, net, netPrior, perAcre };
			})
			.filter(r => r.revenue || r.costs || r.rent);

		if (fieldRows.length) {
			fieldRows.sort((a, b) => b.net - a.net);

			const fieldCard = new Card({ appendTo: this.content });

			new CardLabel({ appendTo: fieldCard, textContent: `Fields — ${yr}` });

			const table = new Component({ appendTo: new TableScroll({ appendTo: fieldCard }) });
			const fieldColumns = { gridTemplateColumns: '1fr 70px 70px 70px 80px 60px' };

			// Column header
			const header = new GridRow({ appendTo: table, addClass: 'head', style: fieldColumns });

			for (const t of ['Field', 'Revenue', 'Costs', 'Rent', 'Net', '/Acre']) {
				new Elem({
					tag: 'div',
					appendTo: header,
					style: { textAlign: t === 'Field' ? 'left' : 'right' },
					textContent: t,
				});
			}

			for (const { field, revenue, costs, rent, net, netPrior, perAcre } of fieldRows) {
				const row = new GridRow({ appendTo: table, style: fieldColumns });

				const nameWrap = new Component({ appendTo: row, style: { minWidth: '0' } });
				new RowName({ appendTo: nameWrap, textContent: field.name || 'Field' });

				// YoY trend indicator
				if (netPrior !== null) {
					const delta = net - netPrior;
					const pct = netPrior !== 0 ? ((delta / Math.abs(netPrior)) * 100).toFixed(0) : null;
					let arrow;
					if (delta > 0) arrow = '▲';
					else if (delta < 0) arrow = '▼';
					else arrow = '→';
					const label = pct !== null ? `${arrow} ${Math.abs(pct)}%` : arrow;

					new Elem({
						tag: 'div',
						appendTo: nameWrap,
						style: { fontSize: '10px', color: signColor(delta) },
						textContent: `vs ${yr - 1}: ${label}`,
					});
				}

				const money = v => {
					const s = v ? formatMoney(v) : '—';
					let c;
					if (v > 0) c = colors.muted;
					else if (v < 0) c = colors.light(colors.warning);
					else c = colors.gray;
					return { textContent: s, style: { fontSize: '12px', color: c, textAlign: 'right' } };
				};

				new Elem({ tag: 'div', appendTo: row, ...money(revenue) });
				new Elem({ tag: 'div', appendTo: row, ...money(costs) });
				new Elem({ tag: 'div', appendTo: row, ...money(rent) });

				const netColor = signColor(net);

				new Elem({
					tag: 'div',
					appendTo: row,
					style: { fontSize: '13px', fontWeight: '700', color: netColor, textAlign: 'right' },
					textContent: formatMoney(net),
				});

				new Elem({
					tag: 'div',
					appendTo: row,
					style: { fontSize: '11px', color: netColor, textAlign: 'right' },
					textContent: perAcre !== null ? formatMoney(perAcre) : '—',
				});
			}
		}

		// ── Season-over-season matrix ─────────────────────────────────────────────
		this._renderSeasonMatrix(econByField, rentByField, fieldList);
	}

	// Acreage for a field id, normalised to acres. Returns 1 if unknown so cost-per-acre
	// calculations degrade gracefully rather than dividing by zero.
	_acreageFor(fieldId) {
		const f = (this._fields?.body || {})[fieldId];
		return f ? convertArea(toSqm(f.acreage, f.acreageUnit || 'ac'), 'ac') : 1;
	}

	_renderSeasonMatrix(econByField, rentByField, fieldList) {
		// Derive years from the economics data already in hand — no need to re-read events
		const years = [
			...new Set(
				Object.values(econByField)
					.flat()
					.map(d => d.year),
			),
		]
			.filter(y => y >= new Date().getFullYear() - 4)
			.sort((a, b) => a - b);

		if (years.length < 2) return; // need at least 2 seasons for a comparison to be meaningful

		// Only include fields that have data in at least 2 seasons
		const activeFields = fieldList.filter(field => {
			const data = econByField[field.id] || [];
			return data.filter(d => d.revenue || d.inputCost).length >= 2;
		});

		if (!activeFields.length) return;

		const matCard = new Card({ appendTo: this.content });

		new CardLabel({ appendTo: matCard, textContent: 'Season Comparison — Net P/L by Field' });

		const columns = { gridTemplateColumns: `150px ${years.map(() => '1fr').join(' ')}`, gap: space.xs };
		const table = new Component({ appendTo: new TableScroll({ appendTo: matCard }) });
		const header = new GridRow({ appendTo: table, addClass: 'head', style: columns });

		new Elem({ tag: 'div', appendTo: header }); // empty corner

		for (const y of years) {
			new Elem({
				tag: 'div',
				appendTo: header,
				style: { fontSize: '11px', textAlign: 'right', fontWeight: '600' },
				textContent: String(y),
			});
		}

		for (const field of activeFields.sort((a, b) => (a.name || '').localeCompare(b.name || ''))) {
			const ac = this._acreageFor(field.id);
			const rent = rentByField[field.id] || 0;
			const fData = econByField[field.id] || [];
			const row = new GridRow({ appendTo: table, style: { ...columns, padding: `${space.sm} 0` } });

			new RowName({ appendTo: row, style: { fontSize: '12px' }, textContent: field.name || 'Field' });

			for (const y of years) {
				const d = fData.find(r => r.year === y);
				const net = d ? d.revenue - d.inputCost * ac - rent : null;

				if (net === null) {
					new Elem({ tag: 'div', appendTo: row, style: { textAlign: 'right' } });
					continue;
				}

				let bg;
				if (net > 0) bg = colors.alpha(colors.success, 0.1);
				else if (net < 0) bg = colors.alpha(colors.danger, 0.1);
				else bg = 'transparent';

				new Elem({
					tag: 'div',
					appendTo: row,
					style: {
						textAlign: 'right',
						fontSize: '12px',
						fontWeight: '600',
						color: signColor(net),
						background: bg,
						borderRadius: radius.sm,
						padding: `${space.xs} ${space.xs}`,
					},
					textContent: formatMoney(net),
				});
			}
		}

		new Note({
			appendTo: matCard,
			textContent: 'Net = harvest revenue − field costs − cash rent. Costs are per-acre rates × field acreage.',
		});
	}

	_renderBudgetCard(yr, _lastMonth, _MONTHS) {
		const allBudget = Object.values(this._budget?.body || {});
		const activeItems = allBudget.filter(b => {
			if (b.startDate && parseDate(b.startDate).getFullYear() > yr) return false;
			if (b.endDate && parseDate(b.endDate).getFullYear() < yr) return false;

			return true;
		});

		if (!activeItems.length) return;

		const budgetCard = new Card({ appendTo: this.content });

		new CardLabel({ appendTo: budgetCard, textContent: `Recurring Budget — ${yr}` });

		const incItems = activeItems.filter(b => b.type === 'income');
		const expItems = activeItems.filter(b => b.type === 'expense');
		const budgetInc = incItems.reduce((s, b) => s + annualAmount(b), 0);
		const budgetExp = expItems.reduce((s, b) => s + annualAmount(b), 0);
		const budgetNet = budgetInc - budgetExp;

		const budgetRow = new Component({
			appendTo: budgetCard,
			style: { display: 'flex', gap: space.lg, marginBottom: space.md, flexWrap: 'wrap' },
		});

		if (budgetInc)
			new Elem({
				tag: 'span',
				appendTo: budgetRow,
				style: { fontSize: '12px', color: colors.light(colors.success) },
				textContent: `Expected income: ${formatDollar(budgetInc)}/yr`,
			});
		if (budgetExp)
			new Elem({
				tag: 'span',
				appendTo: budgetRow,
				style: { fontSize: '12px', color: colors.light(colors.warning) },
				textContent: `Expected expenses: ${formatDollar(budgetExp)}/yr`,
			});

		const netColor = budgetNet >= 0 ? colors.light(colors.success) : colors.light(colors.danger);

		new Elem({
			tag: 'span',
			appendTo: budgetRow,
			style: { fontSize: '12px', color: netColor, fontWeight: '600' },
			textContent: `Net: ${budgetNet >= 0 ? '+' : ''}${formatDollar(Math.abs(budgetNet))}/yr`,
		});

		// Line items
		for (const { items, color, label } of [
			{ items: incItems, color: colors.light(colors.success), label: 'Income' },
			{ items: expItems, color: colors.light(colors.warning), label: 'Expenses' },
		]) {
			if (!items.length) continue;

			new SectionLabel({ appendTo: budgetCard, style: { margin: `${space.sm} 0 ${space.xs}` }, textContent: label });

			for (const b of items.sort((a, z) => annualAmount(z) - annualAmount(a))) {
				const freq = FREQUENCIES.find(f => f.value === b.frequency);
				const row = new AmountRow({ appendTo: budgetCard, style: { padding: `${space.xs} 0` } });
				const nameText = b.entityName ? `${b.name} (${b.entityName})` : b.name;

				new Elem({ tag: 'span', appendTo: row, style: { color: colors.muted }, textContent: nameText });
				new Elem({ tag: 'span', appendTo: row, style: { color } }).elem.textContent =
					`${formatDollar(b.amount)}/${freq?.label?.toLowerCase() || b.frequency}`;
			}
		}
	}
}
