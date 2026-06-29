import { Component, Elem, styled, BottomSheet } from '@vanilla-bean/components';
import { pointInPolygon } from './geo';
import { getFields, getBuildings, createEvent } from './api';
import { createApplicationLog } from './api/applicationLogs';
import { CATEGORIES as APP_CATEGORIES } from './ApplicationLog/ApplicationLogDialog';
import { FormLabel, FormInput, FormSelect } from './Layout';

// ── Constants ──────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
	{ value: 'crop', label: 'Crop', icon: '🌽' },
	{ value: 'harvest', label: 'Harvest', icon: '🌾' },
	{ value: 'livestock', label: 'Livestock', icon: '🐄' },
	{ value: 'cover_crop', label: 'Cover crop', icon: '🌿' },
	{ value: 'input', label: 'Input', icon: '🧪' },
	{ value: 'soil_test', label: 'Soil test', icon: '🔬' },
	{ value: 'tillage', label: 'Tillage', icon: '🚜' },
	{ value: 'observation', label: 'Observation', icon: '👁️' },
];

const LOG_TYPES = [
	{ value: 'event', label: 'Field event', icon: '📋', sub: 'Crop, livestock, harvest, input…' },
	{ value: 'application', label: 'Application', icon: '🧪', sub: 'Pesticide, herbicide, fertilizer…' },
	{ value: 'note', label: 'Quick note', icon: '✏️', sub: 'Observation or reminder' },
];

// ── GPS + field detection ──────────────────────────────────────────────────────

function getPosition(opts = {}) {
	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(new Error('unavailable'));
			return;
		}
		navigator.geolocation.getCurrentPosition(resolve, reject, {
			enableHighAccuracy: true,
			timeout: 10_000,
			maximumAge: 60_000,
			...opts,
		});
	});
}

function detectField(fields, lat, longitude) {
	for (const field of Object.values(fields)) {
		if (field.geometry && pointInPolygon(lat, longitude, field.geometry)) return field;
	}
	return null;
}

function detectBuilding(buildings, lat, longitude) {
	for (const building of Object.values(buildings)) {
		if (building.geometry && pointInPolygon(lat, longitude, building.geometry)) return building;
	}
	return null;
}

// ── Singleton sheet reference ──────────────────────────────────────────────────

let _sheet = null;

// ── Quick Log overlay ──────────────────────────────────────────────────────────

export function openQuickLog() {
	if (_sheet) {
		_sheet.hide();
		_sheet.destroy();
		_sheet = null;
	}

	const sheet = new BottomSheet({
		onClose: () => {
			_sheet = null;
		},
	});
	_sheet = sheet;

	// ── Header ─────────────────────────────────────────────────────────────────
	const header = new Component({
		appendTo: sheet.body,
		style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' },
	});

	const fieldLabel = new Component({ appendTo: header, style: { flex: '1', minWidth: '0' } });

	const fieldName = new Elem({
		tag: 'div',
		appendTo: fieldLabel,
		style: {
			fontSize: '16px',
			fontWeight: '700',
			color: '#fff',
			overflow: 'hidden',
			textOverflow: 'ellipsis',
			whiteSpace: 'nowrap',
		},
		textContent: '📍 Detecting your location…',
	});

	new Elem({
		tag: 'div',
		appendTo: fieldLabel,
		style: { fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' },
		textContent: new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
	});

	new Component({
		tag: 'button',
		appendTo: header,
		textContent: '×',
		style: {
			background: 'none',
			border: 'none',
			color: 'rgba(255,255,255,0.5)',
			fontSize: '22px',
			cursor: 'pointer',
			padding: '4px 8px',
			flexShrink: '0',
		},
		onPointerPress: () => sheet.hide(),
	});

	// ── Body ───────────────────────────────────────────────────────────────────
	const body = new Component({ appendTo: sheet.body, style: { padding: '0 16px 20px' } });

	// ── State ──────────────────────────────────────────────────────────────────
	let currentField = null;
	let currentBuilding = null;
	let locationUserPicked = false;
	let allFields = {};
	let allBuildings = {};

	const setLocation = (field, building) => {
		currentField = field;
		currentBuilding = building;

		if (building && field) {
			fieldName.elem.textContent = `📍 ${building.name || 'Building'} · ${field.name || 'Field'}`;
		} else if (building) {
			fieldName.elem.textContent = `📍 ${building.name || 'Building'}`;
		} else if (field) {
			fieldName.elem.textContent = `📍 ${field.name || 'Field'}`;
		} else {
			fieldName.elem.textContent = '📍 Not in a mapped field or building';
		}
	};

	// ── Start GPS and data fetch in parallel ───────────────────────────────────
	Promise.all([
		getFields().catch(() => ({ body: {} })),
		getBuildings().catch(() => ({ body: {} })),
		getPosition().catch(() => null),
	]).then(([fieldsData, buildingsData, position]) => {
		allFields = fieldsData?.body || {};
		allBuildings = buildingsData?.body || {};

		if (position) {
			const { latitude: lat, longitude } = position.coords;
			const building = detectBuilding(allBuildings, lat, longitude);
			const field = detectField(allFields, lat, longitude);

			setLocation(field, building);
			if (locationSelect && !locationUserPicked) locationSelect.elem.value = building?.id || field?.id || '';
		} else {
			fieldName.elem.textContent = '📍 Location unavailable — select location';
		}
	});

	// ── Log type picker ────────────────────────────────────────────────────────
	const typeGrid = new Component({
		appendTo: body,
		style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '4px' },
	});

	let locationSelect = null;

	LOG_TYPES.forEach(type => {
		const chip = new Component({
			tag: 'button',
			appendTo: typeGrid,
			style: {
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				gap: '4px',
				padding: '14px 8px',
				background: 'rgba(255,255,255,0.06)',
				border: '1px solid rgba(255,255,255,0.1)',
				borderRadius: '10px',
				cursor: 'pointer',
				fontFamily: 'inherit',
				color: '#fff',
				fontSize: '12px',
				fontWeight: '500',
			},
			onPointerPress: () => {
				typeGrid.setStyle({ display: 'none' });
				formArea.setStyle({ display: '' });
				renderForm(type.value);
			},
		});

		new Elem({ tag: 'span', appendTo: chip, style: { fontSize: '24px', lineHeight: '1' }, textContent: type.icon });
		new Elem({ tag: 'span', appendTo: chip, style: { fontSize: '13px', fontWeight: '600' }, textContent: type.label });
		new Elem({
			tag: 'span',
			appendTo: chip,
			style: { fontSize: '10px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
			textContent: type.sub,
		});
	});

	// ── Form area (hidden until type picked) ───────────────────────────────────
	const formArea = new Component({ appendTo: body, style: { display: 'none' } });

	const renderForm = logType => {
		formArea.empty();

		new Component({
			tag: 'button',
			appendTo: formArea,
			textContent: '← Choose type',
			style: {
				display: 'flex',
				alignItems: 'center',
				gap: '5px',
				background: 'none',
				border: 'none',
				color: 'rgba(255,255,255,0.5)',
				fontSize: '13px',
				cursor: 'pointer',
				padding: '0 0 12px',
				fontFamily: 'inherit',
			},
			onPointerPress: () => {
				typeGrid.setStyle({ display: '' });
				formArea.setStyle({ display: 'none' });
				formArea.empty();
				locationSelect = null;
			},
		});

		// Location selector — fields + buildings grouped, GPS-detected pre-selected
		new FormLabel({ appendTo: formArea, textContent: 'Location' });
		locationSelect = new FormSelect({ appendTo: formArea });
		locationSelect.elem.addEventListener('change', () => {
			locationUserPicked = true;
		});

		const populateLocationSelect = (fields, buildings) => {
			locationSelect.elem.innerHTML = '';
			locationSelect.elem.append(new Option('— select —', ''));

			const buildingList = Object.values(buildings).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
			const fieldList = Object.values(fields).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

			if (buildingList.length) {
				const group = document.createElement('optgroup');
				group.label = 'Buildings';
				buildingList.forEach(b => {
					const o = new Option(b.name || 'Unnamed building', b.id);
					o.style.background = '#111';
					group.append(o);
				});
				locationSelect.elem.append(group);
			}

			if (fieldList.length) {
				const group = document.createElement('optgroup');
				group.label = 'Fields';
				fieldList.forEach(f => {
					const o = new Option(f.name || 'Unnamed field', f.id);
					o.style.background = '#111';
					group.append(o);
				});
				locationSelect.elem.append(group);
			}

			locationSelect.elem.value = currentBuilding?.id || currentField?.id || '';
		};

		if (Object.keys(allFields).length || Object.keys(allBuildings).length) {
			populateLocationSelect(allFields, allBuildings);
		} else {
			Promise.all([getFields(), getBuildings()]).then(([fieldsData, buildingsData]) =>
				populateLocationSelect(fieldsData?.body || {}, buildingsData?.body || {}),
			);
		}

		// ── Type-specific fields ───────────────────────────────────────────────
		let getPayload;
		let focusOnError = null;

		if (logType === 'note') {
			new FormLabel({ appendTo: formArea, textContent: 'Note' });
			const noteText = new FormInput({
				tag: 'textarea',
				appendTo: formArea,
				rows: 4,
				placeholder: 'What are you observing?',
				style: { resize: 'vertical' },
			});

			getPayload = () => ({
				fieldId: locationSelect.elem.value || null,
				date: new Date().toISOString().slice(0, 10),
				category: 'observation',
				name: 'Observation',
				notes: noteText.elem.value.trim(),
			});
		} else if (logType === 'event') {
			new FormLabel({ appendTo: formArea, textContent: 'Type' });
			const catGrid = new Component({
				appendTo: formArea,
				style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' },
			});
			let selectedCat = 'crop';
			const catChips = [];

			EVENT_TYPES.forEach(t => {
				const chip = new Component({
					tag: 'button',
					appendTo: catGrid,
					textContent: `${t.icon} ${t.label}`,
					style: {
						padding: '7px 12px',
						borderRadius: '20px',
						cursor: 'pointer',
						fontSize: '13px',
						fontFamily: 'inherit',
						border: `1px solid ${t.value === selectedCat ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)'}`,
						background: t.value === selectedCat ? 'rgba(255,255,255,0.15)' : 'transparent',
						color: '#fff',
					},
					onPointerPress: () => {
						selectedCat = t.value;
						catChips.forEach(c => c.setStyle({ background: 'transparent', borderColor: 'rgba(255,255,255,0.15)' }));
						chip.setStyle({ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' });
					},
				});
				catChips.push(chip);
			});

			new FormLabel({ appendTo: formArea, textContent: 'Name (optional)' });
			const nameInput = new FormInput({ appendTo: formArea, placeholder: 'e.g. Planted corn, 32,000 seeds/ac' });

			new FormLabel({ appendTo: formArea, textContent: 'Notes (optional)' });
			const noteInput = new FormInput({ appendTo: formArea, placeholder: 'Anything else worth capturing' });

			getPayload = () => ({
				fieldId: locationSelect.elem.value || null,
				date: new Date().toISOString().slice(0, 10),
				season: new Date().getFullYear(),
				category: selectedCat,
				name: nameInput.elem.value.trim(),
				notes: noteInput.elem.value.trim(),
			});
		} else if (logType === 'application') {
			new FormLabel({ appendTo: formArea, textContent: 'Category' });
			const catGrid = new Component({
				appendTo: formArea,
				style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' },
			});
			let selectedCat = 'herbicide';
			const catChips = [];

			APP_CATEGORIES.forEach(c => {
				const chip = new Component({
					tag: 'button',
					appendTo: catGrid,
					textContent: c.label,
					style: {
						padding: '7px 12px',
						borderRadius: '20px',
						cursor: 'pointer',
						fontSize: '13px',
						fontFamily: 'inherit',
						border: `1px solid ${c.value === selectedCat ? `${c.color}66` : 'rgba(255,255,255,0.15)'}`,
						background: c.value === selectedCat ? `${c.color}22` : 'transparent',
						color: c.value === selectedCat ? c.color : '#fff',
					},
					onPointerPress: () => {
						selectedCat = c.value;
						catChips.forEach(ch =>
							ch.setStyle({ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,0.15)' }),
						);
						chip.setStyle({ background: `${c.color}22`, color: c.color, borderColor: `${c.color}66` });
					},
				});
				catChips.push(chip);
			});

			new FormLabel({ appendTo: formArea, textContent: 'Product *' });
			const productInput = new FormInput({ appendTo: formArea, placeholder: 'e.g. Roundup PowerMAX' });
			focusOnError = productInput;

			const rateRow = new Component({
				appendTo: formArea,
				style: { display: 'grid', gridTemplateColumns: '1fr 120px', gap: '8px' },
			});
			const rateCol1 = new Component({ appendTo: rateRow });
			const rateCol2 = new Component({ appendTo: rateRow });

			new FormLabel({ appendTo: rateCol1, textContent: 'Rate' });
			const rateInput = new FormInput({ appendTo: rateCol1, type: 'number', step: '0.1', placeholder: '22' });

			new FormLabel({ appendTo: rateCol2, textContent: 'Unit' });
			const unitSelect = new FormSelect({ appendTo: rateCol2 });
			['oz/ac', 'fl oz/ac', 'lbs/ac', 'gal/ac', 'pts/ac'].forEach(u => {
				const o = new Option(u, u);
				o.style.background = '#111';
				unitSelect.elem.append(o);
			});

			new FormLabel({ appendTo: formArea, textContent: 'EPA Reg. # (optional)' });
			const epaInput = new FormInput({ appendTo: formArea, placeholder: '12345-67890' });

			getPayload = () => ({
				fieldId: locationSelect.elem.value || null,
				date: new Date().toISOString().slice(0, 10),
				category: selectedCat,
				product: productInput.elem.value.trim(),
				rate: rateInput.elem.value ? Number(rateInput.elem.value) : null,
				rateUnit: unitSelect.elem.value,
				epaRegNumber: epaInput.elem.value.trim() || null,
				acresTreated: currentField?.acreage ? Number(currentField.acreage) : null,
			});
		}

		// ── Submit button ──────────────────────────────────────────────────────
		const submitBtn = new Component({
			tag: 'button',
			appendTo: formArea,
			textContent: 'Log It',
			style: {
				display: 'block',
				width: '100%',
				marginTop: '18px',
				padding: '15px',
				borderRadius: '10px',
				border: 'none',
				background: '#2d6a2d',
				color: '#fff',
				fontSize: '16px',
				fontWeight: '700',
				cursor: 'pointer',
				fontFamily: 'inherit',
				letterSpacing: '.01em',
			},
			onPointerPress: async () => {
				if (!getPayload) return;

				const payload = getPayload();

				if (logType === 'application' && !payload.product) {
					focusOnError?.elem.focus();
					return;
				}

				submitBtn.elem.disabled = true;
				submitBtn.elem.textContent = 'Saving…';

				try {
					if (logType === 'application') {
						await createApplicationLog({ body: payload });
					} else {
						await createEvent({ body: payload });
					}

					submitBtn.elem.textContent = '✓ Logged';
					submitBtn.setStyle({ background: '#15803d' });
					setTimeout(() => sheet.hide(), 800);
				} catch {
					submitBtn.elem.disabled = false;
					submitBtn.elem.textContent = 'Log It';
					submitBtn.setStyle({ background: '#7f1d1d' });
					setTimeout(() => submitBtn.setStyle({ background: '#2d6a2d' }), 2000);
				}
			},
		});

		requestAnimationFrame(() => formArea.elem.querySelector('input, textarea')?.focus());
	};

	sheet.show();
}

// ── Floating action button ─────────────────────────────────────────────────────

const QuickLogFAB = styled(
	Component,
	() => `
    position: fixed;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 68px);
    right: 16px;
    z-index: 9500;
    width: 54px;
    height: 54px;
    border-radius: 50%;
    border: none;
    background: #2d6a2d;
    color: #fff;
    font-size: 22px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 3px 12px rgba(0,0,0,0.5);
    transition: transform 0.1s, background 0.15s;
    font-family: inherit;

    &:active { transform: scale(0.92); }
`,
);

export function mountQuickLogButton() {
	const btn = new QuickLogFAB({
		tag: 'button',
		appendTo: document.body,
		title: 'Quick log',
		textContent: '+',
		attributes: { 'aria-label': 'Quick log' },
		onPointerPress: openQuickLog,
	});

	const mediaQuery = window.matchMedia('(max-width: 768px)');
	const update = () => btn.setStyle({ display: mediaQuery.matches ? 'flex' : 'none' });
	mediaQuery.addEventListener('change', update);
	update();
}
