import { timingSafeEqual } from 'crypto';

import { requestMatch } from '@vanilla-bean/components/app';
import { formatDate } from '@vanilla-bean/components/utils/date';

import settingsDb from '../database/settings';
import { collectionDBs } from '../database/database';
import archiveDb from '../database/archive';
import { toDateOnly } from '../utils/dates';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// ── Token resolution ────────────────────────────────────────────────────────────

function resolveShareToken(rawToken) {
	const shares = settingsDb.get('shareTokens') ?? [];
	const buf = Buffer.from(rawToken);
	return (
		shares.find(s => {
			if (s.token.length !== rawToken.length) return false;
			try {
				return timingSafeEqual(Buffer.from(s.token), buf);
			} catch {
				return false;
			}
		}) ?? null
	);
}

// A link that expires on a day is good through the end of it
export function isExpired(share) {
	if (!share.expiresAt) return false;
	if (DATE_ONLY.test(share.expiresAt)) return share.expiresAt < toDateOnly();
	return new Date(share.expiresAt) < new Date();
}

function trackView(share) {
	const shares = settingsDb.get('shareTokens') ?? [];
	const updated = shares.map(s =>
		s.id === share.id ? { ...s, viewCount: (s.viewCount || 0) + 1, lastViewed: new Date().toISOString() } : s,
	);
	settingsDb.set('shareTokens', updated).catch(() => {});
}

// ── Data assembly ───────────────────────────────────────────────────────────────

const DB_SOURCES = {
	// main DB — CollectionDB instances; data lives at .data
	fields: () => Object.values(collectionDBs.fields.data || {}),
	leases: () => Object.values(collectionDBs.leases.data || {}),
	loans: () => Object.values(collectionDBs.loans.data || {}),
	equipment: () => Object.values(collectionDBs.equipment.data || {}),
	supplies: () => Object.values(collectionDBs.supplies.data || {}),
	budgetItems: () => Object.values(collectionDBs.budgetItems.data || {}),
	animals: () => Object.values(collectionDBs.animals.data || {}),
	// archive DB (lowdb) — data lives at archiveDb.db.data
	events: () => Object.values(archiveDb.db.data.events || {}),
	maintenance: () => Object.values(archiveDb.db.data.maintenance || {}),
	revenue: () => Object.values(archiveDb.db.data.revenue || {}),
	incidents: () => Object.values(archiveDb.db.data.incidents || {}),
	applicationLogs: () => Object.values(archiveDb.db.data.applicationLogs || {}),
	healthRecords: () => Object.values(archiveDb.db.data.healthRecords || {}),
	breedingRecords: () => Object.values(archiveDb.db.data.breedingRecords || {}),
};

export function filterByScope(records, share, dateField = 'date') {
	let out = records;

	if (share.fieldIds?.length) {
		out = out.filter(r => !r.fieldId || share.fieldIds.includes(r.fieldId));
	}

	if (share.dateRange?.start) {
		out = out.filter(r => !r[dateField] || r[dateField] >= share.dateRange.start);
	}

	if (share.dateRange?.end) {
		out = out.filter(r => !r[dateField] || r[dateField] <= share.dateRange.end);
	}

	return out;
}

function assembleData(share) {
	const result = {};
	const colls = share.collections ?? [];
	const fieldMap = {};
	const rawFields = DB_SOURCES.fields?.() ?? [];
	for (const f of rawFields) fieldMap[f.id] = f;

	for (const coll of colls) {
		if (!DB_SOURCES[coll]) continue;
		const raw = DB_SOURCES[coll]();
		result[coll] = filterByScope(raw, share).sort((a, b) => ((b.date || '') < (a.date || '') ? -1 : 1));
	}

	return { data: result, fieldMap };
}

// ── HTML report builder ─────────────────────────────────────────────────────────

// Text that isn't a date comes back as it was, so it is escaped like any other value
const format = d => escHtml(formatDate(d, { locale: 'en-US', year: 'numeric', month: 'short', day: 'numeric' }) || null);

export const escHtml = s =>
	String(s ?? '—')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');

export function buildHtml(share, data, fieldMap) {
	const colls = share.collections ?? [];
	const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
	const dateRangeLabel = share.dateRange ? `${share.dateRange.start} to ${share.dateRange.end}` : 'All records';

	const SECTION_STYLES = `
		body { font-family: system-ui, -apple-system, sans-serif; max-width: 960px; margin: 0 auto; padding: 24px; color: #1a1a1a; }
		h1 { font-size: 22px; margin: 0 0 4px; color: #1a2e1a; }
		h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .06em; color: #555; border-bottom: 2px solid #2d6a2d; padding-bottom: 5px; margin: 28px 0 10px; }
		.meta { font-size: 13px; color: #555; margin-bottom: 20px; border-left: 3px solid #2d6a2d; padding-left: 10px; }
		.meta strong { color: #1a1a1a; }
		table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
		th { background: #f0f5f0; text-align: left; padding: 7px 8px; border: 1px solid #ccc; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #444; }
		td { padding: 6px 8px; border: 1px solid #ddd; vertical-align: top; }
		tr:nth-child(even) td { background: #f9fbf9; }
		.badge { display: inline-block; padding: 1px 7px; border-radius: 12px; font-size: 11px; font-weight: 600; }
		.badge-herb { background: #d4edda; color: #155724; }
		.badge-insect { background: #fff3cd; color: #856404; }
		.badge-fert { background: #cce5ff; color: #004085; }
		.badge-other { background: #e2e3e5; color: #383d41; }
		.print-btn { background: #2d6a2d; color: #fff; border: none; padding: 10px 20px; font-size: 13px; border-radius: 5px; cursor: pointer; margin-bottom: 20px; }
		.watermark { font-size: 11px; color: #aaa; margin-top: 32px; padding-top: 12px; border-top: 1px solid #eee; }
		@media print { .no-print { display: none !important; } }
	`;

	const catBadge = cat => {
		const cls = { herbicide: 'herb', insecticide: 'insect', fungicide: 'insect', fertilizer: 'fert' }[cat] ?? 'other';
		return `<span class="badge badge-${cls}">${escHtml(cat)}</span>`;
	};

	let sections = '';

	// ── Application records ─────────────────────────────────────────────────────
	if (colls.includes('applicationLogs') && data.applicationLogs?.length) {
		sections += `<h2>Application Records (${data.applicationLogs.length})</h2>
<table>
<thead><tr>
  <th>Date</th><th>Field</th><th>Category</th><th>Product</th>
  <th>EPA Reg #</th><th>Rate</th><th>Method</th>
  <th>REI (hrs)</th><th>PHI (days)</th><th>Operator</th>
</tr></thead><tbody>`;
		for (const r of data.applicationLogs) {
			const field = fieldMap[r.fieldId];
			sections += `<tr>
  <td>${format(r.date)}</td>
  <td>${escHtml(field?.name ?? r.fieldId ?? '—')}</td>
  <td>${catBadge(r.category)}</td>
  <td>${escHtml(r.product)}</td>
  <td style="font-family:monospace">${escHtml(r.epaRegNumber)}</td>
  <td>${escHtml(r.rate)} ${escHtml(r.rateUnit)}</td>
  <td>${escHtml(r.method)}</td>
  <td>${escHtml(r.rei)}</td>
  <td>${escHtml(r.phi)}</td>
  <td>${escHtml(r.operatorName)}</td>
</tr>`;
		}
		sections += '</tbody></table>';
	}

	// ── Field history (events) ──────────────────────────────────────────────────
	if (colls.includes('events') && data.events?.length) {
		const byField = {};
		for (const e of data.events) {
			const fid = e.fieldId || '_unlinked';
			if (!byField[fid]) byField[fid] = [];
			byField[fid].push(e);
		}

		for (const [fid, events] of Object.entries(byField)) {
			const field = fieldMap[fid];
			sections += `<h2>${field ? `${escHtml(field.name)} — Field Events` : 'Unlinked Events'}</h2>`;
			if (field) {
				const tenureLabel = { own: 'Owned', rent: 'Rented' }[field.tenure] ?? '';
				sections += `<p style="font-size:13px;color:#555;margin:0 0 8px">
					${field.acreage ? `<strong>${Number(field.acreage).toFixed(1)} acres</strong> · ` : ''}
					${tenureLabel}
					${field.county ? ` · ${field.county}, ${field.state}` : ''}
				</p>`;
			}
			sections += `<table><thead><tr><th>Date</th><th>Season</th><th>Type</th><th>Description</th><th>Notes</th></tr></thead><tbody>`;
			for (const e of events) {
				const d = typeof e.details === 'object' ? e.details : {};
				const desc = [d.species, d.variety, d.outputType, d.product].filter(Boolean).join(', ');
				sections += `<tr>
  <td>${format(e.date)}</td>
  <td>${escHtml(e.season)}</td>
  <td>${escHtml(e.category?.replace(/_/g, ' '))}</td>
  <td>${escHtml(e.name || desc)}</td>
  <td>${escHtml(e.notes)}</td>
</tr>`;
			}
			sections += '</tbody></table>';
		}
	}

	// ── Equipment / financial snapshot ─────────────────────────────────────────
	if (colls.includes('equipment') && data.equipment?.length) {
		sections += `<h2>Equipment Registry</h2><table>
<thead><tr><th>Name</th><th>Type</th><th>Tenure</th><th>Usage</th><th>Status</th></tr></thead><tbody>`;
		for (const e of data.equipment) {
			sections += `<tr>
  <td>${escHtml(e.name)}</td><td>${escHtml(e.type)}</td>
  <td>${e.tenure === 'own' ? 'Owned' : 'Leased'}</td>
  <td>${e.usage ? `${Number(e.usage).toLocaleString()} ${e.usageUnit || ''}`.trim() : '—'}</td>
  <td>${escHtml(e.status || 'Active')}</td>
</tr>`;
		}
		sections += '</tbody></table>';
	}

	if (colls.includes('revenue') && data.revenue?.length) {
		const total = data.revenue.reduce((s, r) => s + (Number(r.amount) || 0), 0);
		sections += `<h2>Revenue Records — Total: $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
<table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th></tr></thead><tbody>`;
		for (const r of data.revenue) {
			sections += `<tr>
  <td>${format(r.date)}</td><td>${escHtml(r.type)}</td>
  <td>${escHtml(r.description)}</td>
  <td style="text-align:right">$${Number(r.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
</tr>`;
		}
		sections += '</tbody></table>';
	}

	if (colls.includes('loans') && data.loans?.length) {
		sections += `<h2>Loans</h2><table><thead><tr><th>Lender</th><th>Asset</th><th>Original Amount</th><th>Balance</th><th>Rate</th><th>Maturity</th></tr></thead><tbody>`;
		for (const l of data.loans) {
			sections += `<tr>
  <td>${escHtml(l.lender)}</td><td>${escHtml(l.entityName)}</td>
  <td>$${Number(l.loanAmount || 0).toLocaleString()}</td>
  <td>$${Number(l.currentBalance || l.loanAmount || 0).toLocaleString()}</td>
  <td>${l.interestRate ? `${l.interestRate}%` : '—'}</td>
  <td>${format(l.maturityDate)}</td>
</tr>`;
		}
		sections += '</tbody></table>';
	}

	if (colls.includes('incidents') && data.incidents?.length) {
		sections += `<h2>Incident Reports</h2><table><thead><tr><th>Date</th><th>Type</th><th>Severity</th><th>Asset</th><th>Resolved</th></tr></thead><tbody>`;
		for (const r of data.incidents) {
			sections += `<tr>
  <td>${format(r.date)}</td><td>${escHtml(r.type)}</td><td>${escHtml(r.severity)}</td>
  <td>${escHtml(r.entityName)}</td><td>${r.resolved ? '✓ Yes' : 'Open'}</td>
</tr>`;
		}
		sections += '</tbody></table>';
	}

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Farm Records — ${escHtml(share.name)}</title>
<style>${SECTION_STYLES}</style>
</head>
<body>
<div class="no-print">
  <button class="print-btn" onclick="window.print()">⎙ Print / Save as PDF</button>
</div>
<h1>🌾 Farm Records</h1>
<div class="meta">
  <strong>Shared access:</strong> ${escHtml(share.name)}<br>
  <strong>Purpose:</strong> ${escHtml(share.purpose)}<br>
  <strong>Records period:</strong> ${dateRangeLabel}<br>
  <strong>Generated:</strong> ${now}
  ${share.expiresAt ? `<br><strong>This link expires:</strong> ${format(share.expiresAt)}` : ''}
</div>
${sections || '<p style="color:#888;font-style:italic">No records in the specified date range and scope.</p>'}
<div class="watermark">Generated by Land Ledger · Self-hosted farm management</div>
</body>
</html>`;
}

// ── Router ─────────────────────────────────────────────────────────────────────

const sharedRouter = async request => {
	const match = requestMatch('GET', '/shared/:token', request);
	if (!match) return;

	const share = resolveShareToken(match.token);

	if (!share) {
		return new Response('This shared link is invalid or has been revoked.', {
			status: 404,
			headers: { 'Content-Type': 'text/plain' },
		});
	}

	if (isExpired(share)) {
		return new Response('This shared link has expired.', {
			status: 410,
			headers: { 'Content-Type': 'text/plain' },
		});
	}

	trackView(share);

	const { data, fieldMap } = assembleData(share);
	const html = buildHtml(share, data, fieldMap);

	return new Response(html, {
		headers: { 'Content-Type': 'text/html; charset=utf-8' },
	});
};

export default sharedRouter;
