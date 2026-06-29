import { Elem, Component, styled } from '@vanilla-bean/components';

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
import { PageView, PageToolbar, PageTitle } from '../Layout';
import { toSqm, convertArea } from '../geo';
import { economicsByField } from '../Charts/chartData';

const Card = styled(
	Component,
	({ colors }) => `
	background: ${colors.darker(colors.gray)};
	border: 1px solid ${colors.dark(colors.gray)};
	border-radius: 8px;
	padding: 14px 16px;
	margin-bottom: 10px;
`,
);

const formatMoney = n => {
	const abs = Math.abs(n);
	const str = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(0)}`;

	return n < 0 ? `-${str}` : str;
};

const Bar = ({ appendTo, label, amount, total, color }) => {
	const pct = total > 0 ? Math.max(2, (amount / total) * 100) : 0;
	const row = new Component({
		appendTo,
		style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' },
	});

	new Elem({
		tag: 'span',
		appendTo: row,
		style: {
			fontSize: '12px',
			color: 'rgba(255,255,255,0.65)',
			width: '160px',
			flexShrink: '0',
			overflow: 'hidden',
			textOverflow: 'ellipsis',
			whiteSpace: 'nowrap',
		},
		textContent: label,
	});

	const track = new Elem({
		tag: 'div',
		appendTo: row,
		style: { flex: '1', height: '6px', background: 'rgba(255,255,255,0.07)', borderRadius: '3px', overflow: 'hidden' },
	});

	new Elem({
		tag: 'div',
		appendTo: track,
		style: { width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.3s' },
	});
	new Elem({
		tag: 'span',
		appendTo: row,
		style: { fontSize: '12px', color, fontWeight: '600', width: '52px', textAlign: 'right', flexShrink: '0' },
		textContent: formatMoney(amount),
	});
};

const YEAR = new Date().getFullYear();

export default class Financials extends AsyncView {
	_buildView() {
		this.toolbar = new PageToolbar({ appendTo: this });
		new PageTitle({ appendTo: this.toolbar, textContent: 'Financials' });

		// Year selector
		const yearSelect = new Elem({
			tag: 'select',
			appendTo: this.toolbar,
			style: {
				background: 'transparent',
				border: '1px solid rgba(255,255,255,0.2)',
				borderRadius: '4px',
				color: '#fff',
				fontSize: '13px',
				padding: '4px 8px',
				cursor: 'pointer',
				fontFamily: 'inherit',
			},
		});

		[YEAR, YEAR - 1, YEAR - 2].forEach(y => {
			const o = document.createElement('option');
			o.value = y;
			o.textContent = y;
			yearSelect.elem.append(o);
		});
		yearSelect.elem.value = YEAR;

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
		const eventDate = e => (e.date ? new Date(e.date) : null);
		const inYear = d => d && d.getFullYear() === yr;

		const fieldList = Object.values(this._fields?.body || {});

		// ── Build monthly buckets ─────────────────────────────────────────────────
		const byMonth = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));

		// Revenue table entries (building income, equipment hire, inventory sales)
		for (const r of Object.values(this._rev?.body || {})) {
			const d = r.date ? new Date(r.date) : null;

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
			const d = m.date ? new Date(m.date) : null;

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
			const d = log.date ? new Date(log.date) : null;

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
				style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' },
			});

			new Elem({
				tag: 'div',
				appendTo: nwHeader,
				style: {
					fontSize: '11px',
					textTransform: 'uppercase',
					letterSpacing: '.07em',
					color: 'rgba(255,255,255,0.35)',
				},
				textContent: 'Net Worth Snapshot',
			});

			const nw = inventoryValue + appraisedAssets + equipmentAppraisedValue - outstandingLoans;
			const nwColor = nw >= 0 ? '#4caf50' : '#e05252';

			new Elem({
				tag: 'div',
				appendTo: nwHeader,
				style: { fontSize: '18px', fontWeight: '700', color: nwColor },
				textContent: formatDollar(nw),
			});

			const nwRows = [
				inventoryValue > 0 ? ['📦 Supplies inventory', inventoryValue, '#4caf50'] : null,
				equipmentAppraisedValue > 0 ? ['🚜 Equipment (appraised)', equipmentAppraisedValue, '#4caf50'] : null,
				appraisedAssets > 0 ? ['🏠 Property (appraised)', appraisedAssets, '#4caf50'] : null,
				outstandingLoans > 0 ? ['🏦 Outstanding loans', -outstandingLoans, '#e05252'] : null,
			].filter(Boolean);

			for (const [label, amount, color] of nwRows) {
				const row = new Component({
					appendTo: nwCard,
					style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '2px 0' },
				});

				new Elem({ tag: 'span', appendTo: row, style: { color: 'rgba(255,255,255,0.5)' }, textContent: label });
				new Elem({ tag: 'span', appendTo: row, style: { color } }).elem.textContent =
					`${amount >= 0 ? '+' : ''}${formatDollar(Math.abs(amount))}`;
			}

			// Per-loan equity breakdown
			if (loanEquity.length) {
				new Elem({
					tag: 'div',
					appendTo: nwCard,
					style: {
						marginTop: '8px',
						paddingTop: '8px',
						borderTop: '1px solid rgba(255,255,255,0.08)',
						fontSize: '10px',
						textTransform: 'uppercase',
						letterSpacing: '.06em',
						color: 'rgba(255,255,255,0.25)',
						marginBottom: '4px',
					},
					textContent: 'Equity by Asset',
				});

				for (const l of loanEquity) {
					const eqColor = l.equity >= 0 ? '#4caf50' : '#e05252';
					const row = new Component({
						appendTo: nwCard,
						style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '2px 0' },
					});

					new Elem({
						tag: 'span',
						appendTo: row,
						style: { color: 'rgba(255,255,255,0.5)' },
						textContent: `${l.name} (${l.ltv}% LTV)`,
					});
					new Elem({ tag: 'span', appendTo: row, style: { color: eqColor, fontWeight: '600' } }).elem.textContent =
						`${formatDollar(l.equity)} equity`;
				}
			}
		}

		// ── Recurring budget items (always shown when present) ───────────────────
		this._renderBudgetCard(yr, lastMonth, MONTHS);

		if (totalRevenue === 0 && totalExpenses === 0) {
			new Elem({
				tag: 'div',
				appendTo: this.content,
				style: { fontSize: '13px', color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '24px 0' },
				textContent: `No transactions recorded for ${yr}`,
			});

			return;
		}

		// ── Monthly grid ──────────────────────────────────────────────────────────
		const monthCard = new Card({ appendTo: this.content });
		const monthHeader = new Component({
			appendTo: monthCard,
			style: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
		});

		new Elem({
			tag: 'div',
			appendTo: monthHeader,
			style: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.07em', color: 'rgba(255,255,255,0.35)' },
			textContent: `Monthly — ${yr}${isThisYear ? ` (through ${MONTHS[lastMonth]})` : ''}`,
		});

		const monthsWithData = MONTHS.map((name, i) => ({ name, i, ...byMonth[i] })).filter(
			m => m.i <= lastMonth && (m.income || m.expense),
		);

		if (!monthsWithData.length) {
			new Elem({
				tag: 'div',
				appendTo: monthCard,
				style: { fontSize: '12px', color: 'rgba(255,255,255,0.25)' },
				textContent: 'No recorded transactions yet',
			});
		} else {
			const maxVal = Math.max(...monthsWithData.map(m => Math.max(m.income, m.expense)), 1);

			for (const m of monthsWithData) {
				const mRow = new Component({
					appendTo: monthCard,
					style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' },
				});

				new Elem({
					tag: 'span',
					appendTo: mRow,
					style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)', width: '26px', flexShrink: '0' },
					textContent: m.name,
				});

				const barArea = new Component({
					appendTo: mRow,
					style: { flex: '1', display: 'flex', flexDirection: 'column', gap: '2px' },
				});

				if (m.income) {
					const incTrack = new Elem({
						tag: 'div',
						appendTo: barArea,
						style: { height: '5px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px', overflow: 'hidden' },
					});

					new Elem({
						tag: 'div',
						appendTo: incTrack,
						style: {
							width: `${(m.income / maxVal) * 100}%`,
							height: '100%',
							background: '#4caf50',
							borderRadius: '2px',
						},
					});
				}

				if (m.expense) {
					const expTrack = new Elem({
						tag: 'div',
						appendTo: barArea,
						style: { height: '5px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px', overflow: 'hidden' },
					});

					new Elem({
						tag: 'div',
						appendTo: expTrack,
						style: {
							width: `${(m.expense / maxVal) * 100}%`,
							height: '100%',
							background: '#e8c42a',
							borderRadius: '2px',
						},
					});
				}

				const net = m.income - m.expense;
				let netColor;
				if (net > 0) netColor = '#4caf50';
				else if (net < 0) netColor = '#e05252';
				else netColor = 'rgba(255,255,255,0.3)';

				new Elem({
					tag: 'span',
					appendTo: mRow,
					style: { fontSize: '11px', color: netColor, width: '52px', textAlign: 'right', flexShrink: '0' },
					textContent: net !== 0 ? formatMoney(net) : '—',
				});
			}

			// Legend
			const legend = new Component({ appendTo: monthCard, style: { display: 'flex', gap: '12px', marginTop: '6px' } });

			[
				['#4caf50', 'Income'],
				['#e8c42a', 'Expense'],
			].forEach(([color, label]) => {
				const item = new Component({ appendTo: legend, style: { display: 'flex', alignItems: 'center', gap: '4px' } });

				new Elem({
					tag: 'div',
					appendTo: item,
					style: { width: '10px', height: '4px', background: color, borderRadius: '2px' },
				});
				new Elem({
					tag: 'span',
					appendTo: item,
					style: { fontSize: '10px', color: 'rgba(255,255,255,0.3)' },
					textContent: label,
				});
			});
		}

		// ── Income breakdown ──────────────────────────────────────────────────────
		if (totalRevenue > 0) {
			const incCard = new Card({ appendTo: this.content });

			new Elem({
				tag: 'div',
				appendTo: incCard,
				style: {
					fontSize: '11px',
					textTransform: 'uppercase',
					letterSpacing: '.07em',
					color: 'rgba(255,255,255,0.35)',
					marginBottom: '10px',
				},
				textContent: 'Income Sources',
			});

			// Tally recorded revenue by type + harvest events
			const incByType = new Map();

			for (const r of Object.values(this._rev?.body || {})) {
				const d = r.date ? new Date(r.date) : null;

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

			for (const s of incSources) Bar({ appendTo: incCard, ...s, total: totalRevenue, color: '#4caf50' });
		}

		// ── Expense breakdown ─────────────────────────────────────────────────────
		if (totalExpenses > 0) {
			const expCard = new Card({ appendTo: this.content });

			new Elem({
				tag: 'div',
				appendTo: expCard,
				style: {
					fontSize: '11px',
					textTransform: 'uppercase',
					letterSpacing: '.07em',
					color: 'rgba(255,255,255,0.35)',
					marginBottom: '10px',
				},
				textContent: 'Where It Went',
			});

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
				.filter(m => inYear(m.date ? new Date(m.date) : null))
				.reduce((s, m) => s + (Number(m.cost) || 0), 0);

			if (maintenanceTotal > 0) expByType.set('🔧 Maintenance', maintenanceTotal);

			// Feeding costs
			const feedTotal = Object.values(this._feedingLogs?.body || {})
				.filter(l => inYear(l.date ? new Date(l.date) : null))
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

			for (const s of expSources) Bar({ appendTo: expCard, ...s, total: totalExpenses, color: '#e8c42a' });
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

			new Elem({
				tag: 'div',
				appendTo: fieldCard,
				style: {
					fontSize: '11px',
					textTransform: 'uppercase',
					letterSpacing: '.07em',
					color: 'rgba(255,255,255,0.35)',
					marginBottom: '10px',
				},
				textContent: `Fields — ${yr}`,
			});

			// Column header
			const header = new Component({
				appendTo: fieldCard,
				style: {
					display: 'grid',
					gridTemplateColumns: '1fr 70px 70px 70px 80px 60px',
					gap: '6px',
					padding: '2px 0 6px',
					borderBottom: '1px solid rgba(255,255,255,0.08)',
				},
			});

			for (const t of ['Field', 'Revenue', 'Costs', 'Rent', 'Net', '/Acre']) {
				new Elem({
					tag: 'div',
					appendTo: header,
					style: {
						fontSize: '10px',
						textTransform: 'uppercase',
						letterSpacing: '.06em',
						color: 'rgba(255,255,255,0.3)',
						textAlign: t === 'Field' ? 'left' : 'right',
					},
					textContent: t,
				});
			}

			for (const { field, revenue, costs, rent, net, netPrior, perAcre } of fieldRows) {
				const row = new Component({
					appendTo: fieldCard,
					style: {
						display: 'grid',
						gridTemplateColumns: '1fr 70px 70px 70px 80px 60px',
						gap: '6px',
						padding: '7px 0',
						borderBottom: '1px solid rgba(255,255,255,0.05)',
						alignItems: 'center',
					},
				});

				const nameWrap = new Component({ appendTo: row });
				new Elem({
					tag: 'div',
					appendTo: nameWrap,
					style: { fontSize: '13px', fontWeight: '600', color: '#fff' },
					textContent: field.name || 'Field',
				});

				// YoY trend indicator
				if (netPrior !== null) {
					const delta = net - netPrior;
					const pct = netPrior !== 0 ? ((delta / Math.abs(netPrior)) * 100).toFixed(0) : null;
					let color;
					if (delta > 0) color = '#4caf50';
					else if (delta < 0) color = '#e05252';
					else color = 'rgba(255,255,255,0.3)';
					let arrow;
					if (delta > 0) arrow = '▲';
					else if (delta < 0) arrow = '▼';
					else arrow = '→';
					const label = pct !== null ? `${arrow} ${Math.abs(pct)}%` : arrow;

					new Elem({
						tag: 'div',
						appendTo: nameWrap,
						style: { fontSize: '10px', color },
						textContent: `vs ${yr - 1}: ${label}`,
					});
				}

				const money = (v, emptyColor = 'rgba(255,255,255,0.25)') => {
					const s = v ? formatMoney(v) : '—';
					let c;
					if (v > 0) c = 'rgba(255,255,255,0.6)';
					else if (v < 0) c = '#e8c42a';
					else c = emptyColor;
					return { textContent: s, style: { fontSize: '12px', color: c, textAlign: 'right' } };
				};

				new Elem({ tag: 'div', appendTo: row, ...money(revenue) });
				new Elem({ tag: 'div', appendTo: row, ...money(costs) });
				new Elem({ tag: 'div', appendTo: row, ...money(rent) });

				let netColor;
				if (net > 0) netColor = '#4caf50';
				else if (net < 0) netColor = '#e05252';
				else netColor = 'rgba(255,255,255,0.3)';
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

		new Elem({
			tag: 'div',
			appendTo: matCard,
			style: {
				fontSize: '11px',
				textTransform: 'uppercase',
				letterSpacing: '.07em',
				color: 'rgba(255,255,255,0.35)',
				marginBottom: '10px',
			},
			textContent: 'Season Comparison — Net P/L by Field',
		});

		const cols = `150px ${years.map(() => '1fr').join(' ')}`;
		const header = new Component({
			appendTo: matCard,
			style: {
				display: 'grid',
				gridTemplateColumns: cols,
				gap: '4px',
				paddingBottom: '6px',
				borderBottom: '1px solid rgba(255,255,255,0.08)',
			},
		});

		new Elem({ tag: 'div', appendTo: header }); // empty corner

		for (const y of years) {
			new Elem({
				tag: 'div',
				appendTo: header,
				style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)', textAlign: 'right', fontWeight: '600' },
				textContent: String(y),
			});
		}

		for (const field of activeFields.sort((a, b) => (a.name || '').localeCompare(b.name || ''))) {
			const ac = this._acreageFor(field.id);
			const rent = rentByField[field.id] || 0;
			const fData = econByField[field.id] || [];
			const row = new Component({
				appendTo: matCard,
				style: {
					display: 'grid',
					gridTemplateColumns: cols,
					gap: '4px',
					padding: '6px 0',
					borderBottom: '1px solid rgba(255,255,255,0.05)',
					alignItems: 'center',
				},
			});

			new Elem({
				tag: 'div',
				appendTo: row,
				style: {
					fontSize: '12px',
					fontWeight: '600',
					color: '#fff',
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap',
				},
				textContent: field.name || 'Field',
			});

			for (const y of years) {
				const d = fData.find(r => r.year === y);
				const net = d ? d.revenue - d.inputCost * ac - rent : null;

				if (net === null) {
					new Elem({ tag: 'div', appendTo: row, style: { textAlign: 'right' } });
					continue;
				}

				let color;
				if (net > 0) color = '#4caf50';
				else if (net < 0) color = '#e05252';
				else color = 'rgba(255,255,255,0.3)';
				let bg;
				if (net > 0) bg = 'rgba(76,175,80,0.1)';
				else if (net < 0) bg = 'rgba(224,82,82,0.1)';
				else bg = 'transparent';

				new Elem({
					tag: 'div',
					appendTo: row,
					style: {
						textAlign: 'right',
						fontSize: '12px',
						fontWeight: '600',
						color,
						background: bg,
						borderRadius: '4px',
						padding: '2px 4px',
					},
					textContent: formatMoney(net),
				});
			}
		}

		new Elem({
			tag: 'div',
			appendTo: matCard,
			style: { fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '8px' },
			textContent: 'Net = harvest revenue − field costs − cash rent. Costs are per-acre rates × field acreage.',
		});
	}

	_renderBudgetCard(yr, _lastMonth, _MONTHS) {
		const allBudget = Object.values(this._budget?.body || {});
		const activeItems = allBudget.filter(b => {
			if (b.startDate && new Date(b.startDate).getFullYear() > yr) return false;
			if (b.endDate && new Date(b.endDate).getFullYear() < yr) return false;

			return true;
		});

		if (!activeItems.length) return;

		const budgetCard = new Card({ appendTo: this.content });

		new Elem({
			tag: 'div',
			appendTo: budgetCard,
			style: {
				fontSize: '11px',
				textTransform: 'uppercase',
				letterSpacing: '.07em',
				color: 'rgba(255,255,255,0.35)',
				marginBottom: '10px',
			},
			textContent: `Recurring Budget — ${yr}`,
		});

		const incItems = activeItems.filter(b => b.type === 'income');
		const expItems = activeItems.filter(b => b.type === 'expense');
		const budgetInc = incItems.reduce((s, b) => s + annualAmount(b), 0);
		const budgetExp = expItems.reduce((s, b) => s + annualAmount(b), 0);
		const budgetNet = budgetInc - budgetExp;

		const budgetRow = new Component({
			appendTo: budgetCard,
			style: { display: 'flex', gap: '16px', marginBottom: '10px', flexWrap: 'wrap' },
		});

		if (budgetInc)
			new Elem({
				tag: 'span',
				appendTo: budgetRow,
				style: { fontSize: '12px', color: '#4caf50' },
				textContent: `Expected income: ${formatDollar(budgetInc)}/yr`,
			});
		if (budgetExp)
			new Elem({
				tag: 'span',
				appendTo: budgetRow,
				style: { fontSize: '12px', color: '#e8c42a' },
				textContent: `Expected expenses: ${formatDollar(budgetExp)}/yr`,
			});

		const netColor = budgetNet >= 0 ? '#4caf50' : '#e05252';

		new Elem({
			tag: 'span',
			appendTo: budgetRow,
			style: { fontSize: '12px', color: netColor, fontWeight: '600' },
			textContent: `Net: ${budgetNet >= 0 ? '+' : ''}${formatDollar(Math.abs(budgetNet))}/yr`,
		});

		// Line items
		for (const { items, color, label } of [
			{ items: incItems, color: '#4caf50', label: 'Income' },
			{ items: expItems, color: '#e8c42a', label: 'Expenses' },
		]) {
			if (!items.length) continue;

			new Elem({
				tag: 'div',
				appendTo: budgetCard,
				style: {
					fontSize: '10px',
					textTransform: 'uppercase',
					letterSpacing: '.06em',
					color: 'rgba(255,255,255,0.25)',
					padding: '8px 0 2px',
				},
				textContent: label,
			});

			for (const b of items.sort((a, z) => annualAmount(z) - annualAmount(a))) {
				const freq = FREQUENCIES.find(f => f.value === b.frequency);
				const row = new Component({
					appendTo: budgetCard,
					style: { display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '12px' },
				});
				const nameText = b.entityName ? `${b.name} (${b.entityName})` : b.name;

				new Elem({ tag: 'span', appendTo: row, style: { color: 'rgba(255,255,255,0.6)' }, textContent: nameText });
				new Elem({ tag: 'span', appendTo: row, style: { color } }).elem.textContent =
					`${formatDollar(b.amount)}/${freq?.label?.toLowerCase() || b.frequency}`;
			}
		}
	}
}
