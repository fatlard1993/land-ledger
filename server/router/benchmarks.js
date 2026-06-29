import requestMatch from '../utils/requestMatch';
import benchmarksDb from '../database/benchmarks';

// ── US state name → NASS two-letter code ──────────────────────────────────────

const STATE_CODES = {
	Alabama: 'AL',
	Alaska: 'AK',
	Arizona: 'AZ',
	Arkansas: 'AR',
	California: 'CA',
	Colorado: 'CO',
	Connecticut: 'CT',
	Delaware: 'DE',
	Florida: 'FL',
	Georgia: 'GA',
	Hawaii: 'HI',
	Idaho: 'ID',
	Illinois: 'IL',
	Indiana: 'IN',
	Iowa: 'IA',
	Kansas: 'KS',
	Kentucky: 'KY',
	Louisiana: 'LA',
	Maine: 'ME',
	Maryland: 'MD',
	Massachusetts: 'MA',
	Michigan: 'MI',
	Minnesota: 'MN',
	Mississippi: 'MS',
	Missouri: 'MO',
	Montana: 'MT',
	Nebraska: 'NE',
	Nevada: 'NV',
	'New Hampshire': 'NH',
	'New Jersey': 'NJ',
	'New Mexico': 'NM',
	'New York': 'NY',
	'North Carolina': 'NC',
	'North Dakota': 'ND',
	Ohio: 'OH',
	Oklahoma: 'OK',
	Oregon: 'OR',
	Pennsylvania: 'PA',
	'Rhode Island': 'RI',
	'South Carolina': 'SC',
	'South Dakota': 'SD',
	Tennessee: 'TN',
	Texas: 'TX',
	Utah: 'UT',
	Vermont: 'VT',
	Virginia: 'VA',
	Washington: 'WA',
	'West Virginia': 'WV',
	Wisconsin: 'WI',
	Wyoming: 'WY',
};

// ── Crop name → NASS commodity descriptor ─────────────────────────────────────

const CROP_TO_NASS = {
	corn: { commodity_desc: 'CORN', unit_desc: 'BU / ACRE' },
	maize: { commodity_desc: 'CORN', unit_desc: 'BU / ACRE' },
	soybeans: { commodity_desc: 'SOYBEANS', unit_desc: 'BU / ACRE' },
	soybean: { commodity_desc: 'SOYBEANS', unit_desc: 'BU / ACRE' },
	soy: { commodity_desc: 'SOYBEANS', unit_desc: 'BU / ACRE' },
	wheat: { commodity_desc: 'WHEAT', unit_desc: 'BU / ACRE' },
	'winter wheat': { commodity_desc: 'WHEAT, WINTER', unit_desc: 'BU / ACRE' },
	'spring wheat': { commodity_desc: 'WHEAT, SPRING, (EXCL DURUM)', unit_desc: 'BU / ACRE' },
	'durum wheat': { commodity_desc: 'WHEAT, DURUM', unit_desc: 'BU / ACRE' },
	barley: { commodity_desc: 'BARLEY', unit_desc: 'BU / ACRE' },
	oats: { commodity_desc: 'OATS', unit_desc: 'BU / ACRE' },
	sorghum: { commodity_desc: 'SORGHUM FOR GRAIN', unit_desc: 'BU / ACRE' },
	'grain sorghum': { commodity_desc: 'SORGHUM FOR GRAIN', unit_desc: 'BU / ACRE' },
	cotton: { commodity_desc: 'COTTON', unit_desc: 'LB / ACRE' },
	hay: { commodity_desc: 'HAY', unit_desc: 'TONS / ACRE' },
	alfalfa: { commodity_desc: 'HAY, ALFALFA', unit_desc: 'TONS / ACRE' },
	sunflower: { commodity_desc: 'SUNFLOWERS', unit_desc: 'LB / ACRE' },
	sunflowers: { commodity_desc: 'SUNFLOWERS', unit_desc: 'LB / ACRE' },
	canola: { commodity_desc: 'CANOLA', unit_desc: 'LB / ACRE' },
	'dry beans': { commodity_desc: 'BEANS, DRY EDIBLE (EXCL LIMA)', unit_desc: 'CWT / ACRE' },
	lentils: { commodity_desc: 'LENTILS', unit_desc: 'LB / ACRE' },
	peas: { commodity_desc: 'PEAS, DRY', unit_desc: 'LB / ACRE' },
	potatoes: { commodity_desc: 'POTATOES', unit_desc: 'CWT / ACRE' },
	'sugar beets': { commodity_desc: 'SUGARBEETS', unit_desc: 'TONS / ACRE' },
	sugarbeets: { commodity_desc: 'SUGARBEETS', unit_desc: 'TONS / ACRE' },
};

// Normalize a crop name to the NASS entry, or null if unrecognized
function resolveCrop(rawCrop) {
	if (!rawCrop) return null;
	return CROP_TO_NASS[rawCrop.toLowerCase().trim()] ?? null;
}

// Normalize "Whitman County" → "WHITMAN"
function countyToNass(rawCounty) {
	return rawCounty
		.replace(/\s*county\s*/i, '')
		.trim()
		.toUpperCase();
}

// Cache key — historical years cache forever; current year gets a 30-day TTL
const cacheKey = (stateCode, county, commodity, year) => `${stateCode}/${county}/${commodity}/${year}`;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function isCacheValid(entry, year) {
	if (!entry) return false;
	// Compute current year at request time — module-level constant breaks on year boundaries
	if (Number(year) < new Date().getFullYear()) return true; // historical — never expires
	return Date.now() - new Date(entry.fetchedAt).getTime() < THIRTY_DAYS_MS;
}

// ── NASS fetch ─────────────────────────────────────────────────────────────────

let _nassApiKey = null;
export const setNassApiKey = key => {
	_nassApiKey = key || null;
};

async function fetchFromNass(stateCode, countyNass, nassEntry, year) {
	if (!_nassApiKey) return null;

	const params = new URLSearchParams({
		key: _nassApiKey,
		source_desc: 'SURVEY',
		sector_desc: 'CROPS',
		commodity_desc: nassEntry.commodity_desc,
		statisticcat_desc: 'YIELD',
		unit_desc: nassEntry.unit_desc,
		agg_level_desc: 'COUNTY',
		state_alpha: stateCode,
		county_name: countyNass,
		year: String(year),
		format: 'JSON',
	});

	try {
		const res = await fetch(`https://quickstats.nass.usda.gov/api/api_GET/?${params}`);
		if (!res.ok) return null;

		const json = await res.json();
		const record = json?.data?.find(d => d.Value && d.Value !== '(D)' && d.Value !== '(NA)');

		if (!record) return null;

		return { value: parseFloat(record.Value), unit: nassEntry.unit_desc };
	} catch {
		return null;
	}
}

// ── Router ─────────────────────────────────────────────────────────────────────

const benchmarksRouter = async request => {
	const match = requestMatch('GET', '/benchmarks/county-yield', request);
	if (!match) return;

	const { state, county, crop, year } = match;

	if (!state || !county || !crop || !year) {
		return new Response('Required: state, county, crop, year', { status: 400 });
	}

	// Accept either a full state name ("Washington") or an existing 2-letter code ("WA").
	// The first-two-letters fallback is wrong for states like Alaska → "AL" (Alabama's code).
	const stateCode = STATE_CODES[state] ?? (state.length === 2 ? state.toUpperCase() : null);

	if (!stateCode) {
		return new Response(`Unknown state "${state}" — use full name (e.g. Washington) or 2-letter code (WA)`, {
			status: 400,
		});
	}
	const countyNass = countyToNass(county);
	const nassEntry = resolveCrop(crop);

	if (!nassEntry) {
		return Response.json({ error: `Crop "${crop}" not in NASS commodity list`, supported: Object.keys(CROP_TO_NASS) });
	}

	const key = cacheKey(stateCode, countyNass, nassEntry.commodity_desc, year);
	const cached = benchmarksDb.get(key);

	if (isCacheValid(cached, year)) {
		return Response.json({ ...cached, cached: true, stateCode, county: countyNass });
	}

	if (!_nassApiKey) {
		return Response.json(
			{ error: 'USDA NASS API key not configured', configureAt: 'PATCH /settings with nassApiKey' },
			{ status: 503 },
		);
	}

	const fresh = await fetchFromNass(stateCode, countyNass, nassEntry, year);

	if (!fresh) {
		return Response.json({ error: 'No NASS data for this county/crop/year combination' }, { status: 404 });
	}

	await benchmarksDb.set(key, fresh);

	return Response.json({ ...fresh, cached: false, stateCode, county: countyNass });
};

export default benchmarksRouter;
